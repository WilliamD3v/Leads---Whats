"use client";

import axios from "@/lib/axios";
import { useMemo, useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { PropsProduct } from "@/types/product";
import { CategoryProps } from "@/types/category";
import ProductList from "../ProductList";
import { generateOrderPDF } from "@/lib/generateOrderExcel";

import {
  FiArrowLeft,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiMove,
  FiShoppingCart,
  FiX,
  FiMinus,
  FiPlus,
  FiFileText,
  FiSend,
} from "react-icons/fi";
import PageLoading from "../PageLoading/page";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  getCatalogConfig,
  saveCategoryOrder,
  saveProductOrder,
  CatalogConfigResponse,
  getCategory,
} from "@/hooks/useClient";

type Props = {
  products?: PropsProduct[];
  adm?: string;
  refetch: () => void;
};

type ProductsByCategory = Record<string, PropsProduct[]>;

type CartItem = {
  cartId: string;
  productId: string;
  productCode: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  priceType: "VAREJO" | "ATACADO";
  wholesaleMinQty: number;
  normalPrice: number;
  wholesalePrice: number;
};

type CustomerData = {
  name: string;
  phone: string;
  notes: string;
};

const OWNER_WHATSAPP = "5583996823375"; // Troque pelo WhatsApp do dono do site. Ex: 5583999999999

function formatProductCode(value: number) {
  return `#${String(value).padStart(4, "0")}`;
}

function normalizeMoney(value: number | string | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value
      .replace(/\s/g, "")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number | string | undefined | null) {
  return normalizeMoney(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getProductPrice(product: PropsProduct) {
  return normalizeMoney(
    (product as any)?.priceUnit ??
      (product as any)?.salePrice ??
      (product as any)?.price ??
      (product as any)?.valor ??
      0,
  );
}

function getWholesalePrice(product: PropsProduct) {
  return normalizeMoney(
    (product as any)?.wholesalePrice ??
      (product as any)?.priceWholesale ??
      (product as any)?.atacadoPrice ??
      (product as any)?.priceAtacado ??
      (product as any)?.valorAtacado ??
      0,
  );
}

function getWholesaleMinQty(product: PropsProduct) {
  const value =
    (product as any)?.wholesaleMinQty ??
    (product as any)?.minWholesaleQty ??
    (product as any)?.minimumWholesaleQuantity ??
    (product as any)?.quantidadeAtacado ??
    (product as any)?.minAtacado ??
    0;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getAppliedPrice(product: PropsProduct, quantity: number) {
  const retailPrice = getProductPrice(product);
  const wholesalePrice = getWholesalePrice(product);
  const wholesaleMinQty = getWholesaleMinQty(product);
  const hasWholesale = wholesalePrice > 0 && wholesaleMinQty > 0;
  const isWholesale = hasWholesale && quantity >= wholesaleMinQty;

  return {
    unitPrice: isWholesale ? wholesalePrice : retailPrice,
    priceType: isWholesale ? "ATACADO" : "VAREJO",
    wholesaleMinQty,
  } as const;
}

function SortableCategoryCard({
  category,
  image,
  isActive,
  onClick,
  sortable,
  onEdit,
  onDelete,
}: {
  category: string;
  image: string;
  isActive: boolean;
  onClick: () => void;
  sortable: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: category,
      disabled: !sortable,
    });

  const style = sortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:bg-orange-50"
          >
            <FiEdit2 size={12} className="text-orange-600" />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:bg-red-50"
          >
            <FiTrash2 size={12} className="text-red-600" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`flex w-[92px] min-w-[92px] flex-col items-center gap-2 rounded-[22px] bg-white p-2 pb-3 transition sm:w-[104px] sm:min-w-[104px] sm:rounded-[26px] sm:p-[10px] sm:pb-3 ${
          isActive
            ? "border-2 border-orange-500 shadow-[0_18px_34px_rgba(249,115,22,0.16)]"
            : "border border-neutral-200 shadow-[0_10px_22px_rgba(15,23,42,0.04)] hover:-translate-y-[2px] hover:border-orange-300"
        }`}
      >
        <img
          src={image}
          alt={category}
          className="h-[68px] w-[68px] rounded-[18px] object-cover sm:h-[76px] sm:w-[76px] sm:rounded-[22px]"
        />

        <span
          className={`block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-bold leading-4 sm:text-[13px] ${
            isActive ? "text-orange-600" : "text-neutral-700"
          }`}
        >
          {category}
        </span>

        {sortable && (
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex h-7 w-[44px] touch-none items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-500 shadow-sm active:cursor-grabbing"
          >
            <FiMove size={14} />
          </div>
        )}
      </button>
    </div>
  );
}

export default function CatalogPage({ products, adm, refetch }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PropsProduct | null>(
    null,
  );

  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [productOrderByCategory, setProductOrderByCategory] = useState<
    Record<string, string[]>
  >({});

  const [cartAnimation, setCartAnimation] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{
    product: PropsProduct;
    productNumber?: number;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState<CustomerData>({
    name: "",
    phone: "",
    notes: "",
  });

  const isAdmin = adm === "admin";

  const { data: configData } = useQuery<CatalogConfigResponse>({
    queryKey: ["catalog-config"],
    queryFn: getCatalogConfig,
    enabled: isAdmin,
  });

  const { data: dataCategory, refetch: refetchCategories } = useQuery<
    CategoryProps[]
  >({
    queryKey: ["Category"],
    queryFn: getCategory,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  useEffect(() => {
    if (openSearch) inputRef.current?.focus();
  }, [openSearch]);

  const productsByCategory = useMemo(() => {
    if (!products) return {};

    return products.reduce((acc, product) => {
      const category = product.category || "Outros";
      acc[category] = acc[category] || [];
      acc[category].push(product);
      return acc;
    }, {} as ProductsByCategory);
  }, [products]);

  const categoriesFromData = useMemo(() => {
    const productCategories = Object.keys(productsByCategory);
    const registeredCategories = (dataCategory || []).map(
      (item) => item.category,
    );

    return [...new Set([...registeredCategories, ...productCategories])];
  }, [productsByCategory, dataCategory]);

  const categoryMap = useMemo(() => {
    if (!dataCategory?.length) return {};

    return dataCategory.reduce(
      (acc, item) => {
        acc[item.category] = item;
        return acc;
      },
      {} as Record<string, CategoryProps>,
    );
  }, [dataCategory]);

  useEffect(() => {
    const backendCategoryOrder = configData?.categoryOrder || [];

    setCategoryOrder(() => {
      if (!categoriesFromData.length) return [];

      const validBackendOrder = backendCategoryOrder.filter((category) =>
        categoriesFromData.includes(category),
      );

      const missingCategories = categoriesFromData.filter(
        (category) => !validBackendOrder.includes(category),
      );

      return [...validBackendOrder, ...missingCategories];
    });

    setSelectedCategory((prev) => {
      if (prev && categoriesFromData.includes(prev)) return prev;
      return categoriesFromData[0] ?? null;
    });

    setProductOrderByCategory(() => {
      const nextState: Record<string, string[]> = {};

      categoriesFromData.forEach((category) => {
        const idsFromData = (productsByCategory[category] || []).map(
          (item) => item._id,
        );
        nextState[category] = idsFromData;
      });

      return nextState;
    });
  }, [categoriesFromData, productsByCategory, configData]);

  useEffect(() => {
    const savedCategory = sessionStorage.getItem("catalog-return-category");

    if (!savedCategory) return;
    if (!categoriesFromData.includes(savedCategory)) return;

    setSelectedCategory(savedCategory);
  }, [categoriesFromData]);

  const orderedCategories = useMemo(() => {
    return categoryOrder;
  }, [categoryOrder]);

  const orderedProductsByCategory = useMemo(() => {
    const result: ProductsByCategory = {};

    orderedCategories.forEach((category) => {
      const originalItems = productsByCategory[category] || [];
      const savedOrder = productOrderByCategory[category] || [];

      if (!savedOrder.length) {
        result[category] = originalItems;
        return;
      }

      const itemsMap = new Map(originalItems.map((item) => [item._id, item]));
      const orderedItems = savedOrder
        .map((id) => itemsMap.get(id))
        .filter(Boolean) as PropsProduct[];

      const missingItems = originalItems.filter(
        (item) => !orderedItems.some((ordered) => ordered._id === item._id),
      );

      result[category] = [...orderedItems, ...missingItems];
    });

    return result;
  }, [orderedCategories, productsByCategory, productOrderByCategory]);

  const currentProducts =
    selectedCategory && orderedProductsByCategory[selectedCategory]
      ? orderedProductsByCategory[selectedCategory]
      : [];

  const currentProductNumbers = useMemo(() => {
    return currentProducts.reduce(
      (acc, product, index) => {
        acc[product._id] = index + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [currentProducts]);

  const filteredProducts = currentProducts.filter((p) => {
    if (!p || typeof p.name !== "string") return false;

    const searchValue = search.toLowerCase().trim();

    const matchName = p.name.toLowerCase().includes(searchValue);
    const number = currentProductNumbers[p._id] || 0;
    const formattedCode = formatProductCode(number);

    const matchNumber =
      String(number).includes(searchValue) ||
      formattedCode.toLowerCase().includes(searchValue) ||
      formattedCode.replace("#", "").includes(searchValue);

    return matchName || matchNumber;
  });

  useEffect(() => {
    const savedProductId = sessionStorage.getItem("catalog-return-product-id");

    if (!savedProductId) return;
    if (!filteredProducts.some((product) => product._id === savedProductId)) {
      return;
    }

    const timeout = setTimeout(() => {
      const element = document.getElementById(`product-card-${savedProductId}`);

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        sessionStorage.removeItem("catalog-return-product-id");
        sessionStorage.removeItem("catalog-return-category");
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [filteredProducts]);

  const selectedCategoryData = selectedCategory
    ? categoryMap[selectedCategory]
    : null;

  const bannerImage =
    selectedCategoryData?.image?.url ||
    (selectedCategory && orderedProductsByCategory[selectedCategory]?.length
      ? orderedProductsByCategory[selectedCategory][0]?.image?.url
      : null);

  const cartTotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const cartQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);

  const pendingPricePreview = pendingProduct
    ? getAppliedPrice(pendingProduct.product, quantity)
    : null;

  const handleOpenQuantityModal = (
    product: PropsProduct,
    productNumber?: number,
  ) => {
    setPendingProduct({ product, productNumber });
    setQuantity(1);
    setQuantityModalOpen(true);
  };

  const handleConfirmAddToCart = () => {
    if (!pendingProduct) return;

    const safeQuantity = Math.max(1, Number(quantity) || 1);
    const product = pendingProduct.product;
    const productAny = product as any;

    const productCode =
      typeof pendingProduct.productNumber === "number"
        ? formatProductCode(pendingProduct.productNumber)
        : "#0000";

    const normalPrice = Number(
      productAny?.priceUnit ?? productAny?.salePrice ?? productAny?.price ?? 0,
    );

    const wholesalePrice = Number(
      productAny?.wholesalePrice ??
        productAny?.priceWholesale ??
        productAny?.atacadoPrice ??
        normalPrice,
    );

    const isWholesale = safeQuantity >= 12;

    const unitPrice = isWholesale ? wholesalePrice : normalPrice;
    const priceType = isWholesale ? "ATACADO" : "VAREJO";

    const item: CartItem = {
      cartId: `${product._id}-${Date.now()}`,
      productId: product._id,
      productCode,
      name: product.name,
      category: product.category || selectedCategory || "Sem categoria",
      quantity: safeQuantity,
      unitPrice,
      subtotal: unitPrice * safeQuantity,
      priceType,
      wholesaleMinQty: 12,
      normalPrice,
      wholesalePrice,
    };

    setCart((prev) => [...prev, item]);
    setQuantityModalOpen(false);
    setPendingProduct(null);
    triggerCartAnimation();
  };

  const handleRemoveCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const handleClearCart = () => {
    if (!window.confirm("Deseja limpar todo o carrinho?")) return;
    setCart([]);
  };

  const handleFinishOrder = () => {
    if (!cart.length) {
      window.alert("Adicione pelo menos um produto ao carrinho.");
      return;
    }

    if (!customer.name.trim()) {
      window.alert("Informe o nome do cliente.");
      return;
    }

    generateOrderPDF({
      customer,
      cart,
    });

    const message = `Olá, segue meu pedido.

Cliente: ${customer.name}
Telefone: ${customer.phone || "Não informado"}
Itens: ${cart.length}
Quantidade total: ${cartQuantity}
Total: ${formatCurrency(cartTotal)}

O arquivo da tabela do pedido foi gerado no meu aparelho. Vou anexar ele nesta conversa.`;

    window.open(
      `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const WHOLESALE_MIN_QTY = 12;

  function getNormalPrice(product: any) {
    return Number(
      product?.priceUnit ?? product?.salePrice ?? product?.price ?? 0,
    );
  }

  function getWholesalePrice(product: any) {
    return Number(
      product?.wholesalePrice ??
        product?.priceWholesale ??
        product?.attackPrice ??
        product?.atacadoPrice ??
        getNormalPrice(product),
    );
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      await axios.delete(`product/delete-product/${id}`);
      await refetch();
      setSelectedProduct(null);
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      window.alert("Erro ao excluir produto.");
    }
  };

  const handleUpdate = (product: PropsProduct) => {
    router.push(`${pathname}/formProduct?id=${product._id}`);
  };

  const handleCategoryEdit = (category: string) => {
    const categoryData = categoryMap[category];
    if (!categoryData) return;

    router.push(
      `${pathname}/formProduct?categoryId=${categoryData._id}&mode=update`,
    );
  };

  const triggerCartAnimation = () => {
    setCartAnimation(true);

    setTimeout(() => {
      setCartAnimation(false);
    }, 700);
  };

  const updateCartQuantity = (cartId: string, nextQuantity: number) => {
    const safeQuantity = Math.max(1, Number(nextQuantity) || 1);

    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId !== cartId) return item;

        const isWholesale = safeQuantity >= 12;

        const unitPrice =
          isWholesale && item.wholesalePrice
            ? item.wholesalePrice
            : (item.normalPrice ?? item.unitPrice);

        return {
          ...item,
          quantity: safeQuantity,
          unitPrice,
          subtotal: unitPrice * safeQuantity,
          priceType: isWholesale ? "ATACADO" : "VAREJO",
          wholesaleMinQty: 12,
        };
      }),
    );
  };

  const incrementCartItem = (cartId: string) => {
    const item = cart.find((i) => i.cartId === cartId);
    if (!item) return;

    updateCartQuantity(cartId, item.quantity + 1);
  };

  const decrementCartItem = (cartId: string) => {
    const item = cart.find((i) => i.cartId === cartId);
    if (!item) return;

    updateCartQuantity(cartId, item.quantity - 1);
  };

  const handleCategoryDelete = async (category: string) => {
    const categoryData = categoryMap[category];
    if (!categoryData) return;

    const totalProductsInCategory = productsByCategory[category]?.length || 0;

    if (totalProductsInCategory > 0) {
      window.alert(
        `Não é possível excluir a categoria "${category}" porque existem ${totalProductsInCategory} produto(s) cadastrados nela.`,
      );
      return;
    }

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir a categoria "${category}"?`,
    );

    if (!confirmDelete) return;

    try {
      await axios.delete(`/category/delete-category/${categoryData._id}`);

      const nextCategories = orderedCategories.filter(
        (item) => item !== category,
      );
      setCategoryOrder(nextCategories);

      setProductOrderByCategory((prev) => {
        const updated = { ...prev };
        delete updated[category];
        return updated;
      });

      if (selectedCategory === category) {
        setSelectedCategory(nextCategories[0] || null);
      }

      await Promise.all([refetch(), refetchCategories()]);
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      window.alert("Erro ao excluir categoria.");
    }
  };

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    if (!isAdmin) return;

    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = categoryOrder.indexOf(String(active.id));
    const newIndex = categoryOrder.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(categoryOrder, oldIndex, newIndex);

    setCategoryOrder(newOrder);

    try {
      await saveCategoryOrder(newOrder);
    } catch (error) {
      console.error("Erro ao salvar ordem das categorias:", error);
    }
  };

  const handleProductDragEnd = async (event: DragEndEvent) => {
    if (!isAdmin || !selectedCategory) return;

    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const visibleIds = currentProducts.map((item) => item._id);
    const oldIndex = visibleIds.indexOf(String(active.id));
    const newIndex = visibleIds.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const newIds = arrayMove(visibleIds, oldIndex, newIndex);

    setProductOrderByCategory((prev) => ({
      ...prev,
      [selectedCategory]: newIds,
    }));

    try {
      await saveProductOrder(selectedCategory, newIds);
      await refetch();
    } catch (error) {
      console.error("Erro ao salvar ordem dos produtos:", error);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffaf5] px-3 py-4 text-neutral-900 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
      {cartAnimation && (
        <div className="pointer-events-none fixed bottom-24 right-8 z-[2000] h-5 w-5 animate-[flyToCart_0.7s_ease-out_forwards] rounded-full bg-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.75)]" />
      )}
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:gap-3 md:flex-row md:items-center">
            {adm === "admin" ? null : (
              <button
                onClick={() => {
                  setLoading(true);
                  router.push("/");
                }}
                className="inline-flex h-11 w-fit items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-[#9a3412] transition hover:border-orange-300 hover:bg-orange-50"
              >
                <FiArrowLeft size={18} />
                Voltar
              </button>
            )}
          </div>

          <div className="flex w-full items-center gap-3 md:w-auto">
            {!isAdmin && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="fixed bottom-5 right-5 z-[900] inline-flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition hover:-translate-y-1 hover:bg-orange-600"
              >
                <FiShoppingCart size={22} />

                {cart.length > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-black text-white">
                    {cart.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setOpenSearch((p) => !p)}
              className="inline-flex h-11 w-11 min-w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_14px_28px_rgba(249,115,22,0.20)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_34px_rgba(249,115,22,0.28)]"
            >
              <FiSearch size={18} />
            </button>

            {openSearch && (
              <input
                ref={inputRef}
                placeholder="Buscar produto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-2xl border border-orange-200 bg-white px-4 text-sm text-neutral-900 shadow-sm outline-none placeholder:text-neutral-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 md:w-[280px]"
              />
            )}
          </div>
        </div>

        {bannerImage && (
          <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] lg:gap-5">
            <div className="relative min-h-[230px] overflow-hidden rounded-[22px] border border-orange-200 bg-neutral-900 shadow-[0_24px_60px_rgba(249,115,22,0.12)] sm:min-h-[280px] sm:rounded-[26px] lg:min-h-[360px] lg:rounded-[30px]">
              <div
                className="absolute inset-0 scale-[1.04] bg-cover bg-center"
                style={{ backgroundImage: `url(${bannerImage})` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,24,39,0.72)_0%,rgba(17,24,39,0.32)_45%,rgba(17,24,39,0.1)_100%),linear-gradient(180deg,rgba(17,24,39,0.08)_0%,rgba(17,24,39,0.3)_100%)]" />

              <div className="relative z-10 flex h-full flex-col justify-end gap-3 p-5 sm:p-6 lg:p-8">
                <span className="inline-flex w-fit rounded-full bg-orange-500 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white sm:text-xs">
                  Categoria em destaque
                </span>

                <h2 className="max-w-[600px] text-2xl font-black leading-tight text-white sm:text-3xl lg:text-[2.5rem] lg:leading-[1.02]">
                  {selectedCategory}
                </h2>

                <p className="max-w-[520px] text-sm leading-6 text-white/90 sm:text-[15px] sm:leading-7">
                  Produtos organizados para uma navegação mais bonita, rápida e
                  profissional.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mb-7">
          <div className="mb-4">
            <h3 className="text-xl font-black text-neutral-900">Categorias</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-500 sm:text-[15px]">
              Escolha uma categoria para visualizar os produtos relacionados.
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext
              items={orderedCategories}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
                {orderedCategories.map((category) => {
                  const items = orderedProductsByCategory[category] || [];
                  const isActive = selectedCategory === category;

                  const categoryImage =
                    categoryMap[category]?.image?.url ||
                    items[0]?.image?.url ||
                    "/images/sem-imagem.png";

                  return (
                    <SortableCategoryCard
                      key={category}
                      category={category}
                      image={categoryImage}
                      isActive={isActive}
                      onClick={() => setSelectedCategory(category)}
                      sortable={isAdmin}
                      onEdit={
                        isAdmin ? () => handleCategoryEdit(category) : undefined
                      }
                      onDelete={
                        isAdmin
                          ? () => handleCategoryDelete(category)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        <section>
          {filteredProducts.length === 0 ? (
            <div className="flex min-h-[32vh] items-center justify-center rounded-[24px] border border-dashed border-orange-300 bg-orange-50 px-6 py-10 text-center text-base font-extrabold text-orange-700 sm:min-h-[42vh] sm:text-xl">
              Nenhum produto encontrado
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-4 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black leading-tight text-neutral-900 sm:text-[2rem]">
                    {selectedCategory}
                  </h2>
                  <p className="mt-2 max-w-[760px] text-sm leading-6 text-neutral-500 sm:text-[15px] sm:leading-7">
                    Explore os melhores itens do mercado com alta qualidade e
                    preços imperdíveis.
                  </p>
                </div>

                <span className="inline-flex h-10 w-fit items-center justify-center rounded-full border border-orange-100 bg-white px-4 text-sm font-bold text-orange-600">
                  {filteredProducts.length} produto
                  {filteredProducts.length !== 1 ? "s" : ""}
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleProductDragEnd}
              >
                <SortableContext
                  items={currentProducts.map((product) => product._id)}
                  strategy={rectSortingStrategy}
                >
                  <ProductList
                    products={filteredProducts}
                    isAdmin={isAdmin}
                    onSelect={setSelectedProduct}
                    sortable={isAdmin}
                    productNumbers={currentProductNumbers}
                    onAddToCart={handleOpenQuantityModal}
                  />
                </SortableContext>
              </DndContext>
            </>
          )}
        </section>
      </div>

      {quantityModalOpen && pendingProduct && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[4px]">
          <div className="w-full max-w-[420px] rounded-[26px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-[11px] font-extrabold text-orange-700">
                  {pendingProduct.productNumber
                    ? formatProductCode(pendingProduct.productNumber)
                    : "Produto"}
                </span>

                <h3 className="mt-3 text-xl font-black leading-7 text-neutral-900">
                  {pendingProduct.product.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setQuantityModalOpen(false);
                  setPendingProduct(null);
                }}
                className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-extrabold text-orange-700 transition hover:bg-orange-100"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-700">
                Quantidade
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-700 shadow-sm"
                >
                  <FiMinus />
                </button>

                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-12 w-full rounded-2xl border border-orange-200 bg-white text-center text-lg font-black text-neutral-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />

                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-700 shadow-sm"
                >
                  <FiPlus />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-xs font-bold text-neutral-500">
                  Preço aplicado
                </p>
                <p className="mt-1 text-lg font-black text-neutral-900">
                  {formatCurrency(pendingPricePreview?.unitPrice || 0)}
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-xs font-bold text-neutral-500">Tipo</p>
                <p
                  className={`mt-1 text-lg font-black ${
                    pendingPricePreview?.priceType === "ATACADO"
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {pendingPricePreview?.priceType || "VAREJO"}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-neutral-900 px-4 py-3 text-xs font-semibold leading-5 text-white">
              Atacado a partir de 12 unidades do mesmo produto:{" "}
              {formatCurrency(getWholesalePrice(pendingProduct.product))}
            </div>

            {quantity < 12 ? (
              <p className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-xs font-bold leading-5 text-orange-700">
                Adicione mais {12 - quantity} unidade(s) para ativar o preço de
                atacado.
              </p>
            ) : (
              <p className="mt-3 rounded-2xl bg-green-50 px-4 py-3 text-xs font-bold leading-5 text-green-700">
                Preço de atacado aplicado neste produto.
              </p>
            )}

            <button
              type="button"
              onClick={handleConfirmAddToCart}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(249,115,22,0.22)] transition hover:brightness-95"
            >
              <FiShoppingCart />
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-[3px]">
          <div className="ml-auto flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl">
            <div className="border-b border-neutral-100 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-neutral-900">
                    Carrinho
                  </h3>
                  <p className="mt-1 text-sm font-medium text-neutral-500">
                    {cart.length} item(ns) • {cartQuantity} produto(s)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-extrabold text-orange-700 transition hover:bg-orange-100"
                >
                  Continuar escolhendo
                </button>
              </div>

              <p className="mt-3 rounded-2xl bg-yellow-50 px-4 py-3 text-xs font-bold leading-5 text-yellow-800">
                As quantidades solicitadas estão sujeitas à confirmação de
                estoque pelo proprietário.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {cart.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center">
                  <div>
                    <FiShoppingCart className="mx-auto text-3xl text-orange-500" />
                    <p className="mt-3 text-sm font-extrabold text-orange-700">
                      Seu carrinho está vazio.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.cartId}
                      className="rounded-[22px] border border-orange-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-700">
                              {item.productCode}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                                item.priceType === "ATACADO"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-neutral-100 text-neutral-700"
                              }`}
                            >
                              {item.priceType}
                            </span>
                          </div>

                          <h4 className="text-[15px] font-black leading-5 text-neutral-900">
                            {item.name}
                          </h4>

                          <p className="mt-1 text-xs font-semibold text-neutral-500">
                            {item.category}
                          </p>

                          <p className="mt-2 text-xs font-bold text-neutral-500">
                            Unitário:{" "}
                            <span className="text-neutral-900">
                              {formatCurrency(item.unitPrice)}
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCartItem(item.cartId)}
                          className="inline-flex h-9 w-9 min-w-9 items-center justify-center rounded-full bg-red-50 text-red-600"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-4 rounded-2xl bg-orange-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="inline-flex items-center rounded-full border border-orange-200 bg-white p-1">
                            <button
                              type="button"
                              onClick={() => decrementCartItem(item.cartId)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-lg font-black text-orange-700"
                            >
                              -
                            </button>

                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartQuantity(
                                  item.cartId,
                                  Number(e.target.value),
                                )
                              }
                              className="h-9 w-14 bg-transparent text-center text-sm font-black text-neutral-900 outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => incrementCartItem(item.cartId)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-lg font-black text-white"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-[11px] font-bold uppercase text-neutral-400">
                              Subtotal
                            </p>
                            <p className="text-lg font-black text-orange-600">
                              {formatCurrency(item.subtotal)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {item.priceType === "VAREJO" && item.quantity < 12 && (
                        <p className="mt-3 rounded-2xl bg-orange-50 px-3 py-2 text-[11px] font-bold leading-5 text-orange-700">
                          Adicione mais {12 - item.quantity} unidade(s) deste
                          produto para ativar o valor de atacado.
                        </p>
                      )}

                      {item.priceType === "ATACADO" && (
                        <p className="mt-3 rounded-2xl bg-green-50 px-3 py-2 text-[11px] font-bold leading-5 text-green-700">
                          Valor de atacado aplicado neste produto.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-100 bg-white p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Nome"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

                <input
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Telefone"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />

                <textarea
                  value={customer.notes}
                  onChange={(e) =>
                    setCustomer((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Obs."
                  rows={2}
                  className="col-span-2 resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="mt-3 rounded-2xl bg-neutral-900 p-3 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70">Total</span>
                  <strong className="text-xl font-black text-white">
                    {formatCurrency(cartTotal)}
                  </strong>
                </div>

                <p className="mt-1 text-[10px] font-medium leading-4 text-white/60">
                  Sujeito à confirmação de estoque pelo proprietário.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={!cart.length}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-xs font-extrabold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiTrash2 />
                  Limpar
                </button>

                <button
                  type="button"
                  onClick={handleFinishOrder}
                  disabled={!cart.length}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiFileText />
                  Gerar
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinishOrder}
                disabled={!cart.length}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-xs font-extrabold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiSend />
                Finalizar no WhatsApp
              </button>

              <p className="mt-2 text-center text-[10px] font-medium leading-4 text-neutral-500">
                O arquivo será baixado e anexado manualmente no WhatsApp.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div
          onClick={() => setSelectedProduct(null)}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[4px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-[24px] bg-white p-6 shadow-2xl"
          >
            <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-extrabold text-neutral-700">
              {selectedCategory
                ? `${selectedCategory} • ${formatProductCode(
                    currentProductNumbers[selectedProduct._id] || 1,
                  )}`
                : formatProductCode(
                    currentProductNumbers[selectedProduct._id] || 1,
                  )}
            </span>

            <h3 className="mt-3 text-xl font-black leading-7 text-neutral-900">
              {selectedProduct.name}
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Escolha a ação que deseja realizar para este produto.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDelete(selectedProduct._id)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-red-600 text-sm font-bold text-white transition hover:bg-red-700"
              >
                <FiTrash2 />
                Deletar
              </button>

              <button
                onClick={() => handleUpdate(selectedProduct)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-bold text-white transition hover:brightness-95"
              >
                <FiEdit2 />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}

      <PageLoading visible={loading} />
    </main>
  );
}
