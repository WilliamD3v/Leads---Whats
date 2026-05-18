"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TIME_OPTIONS = [
  { label: "1 minuto", value: 60 },
  { label: "2 minutos", value: 120 },
  { label: "3 minutos", value: 180 },
  { label: "5 minutos", value: 300 },
  { label: "10 minutos", value: 600 },
];

export default function EnviosWhatsappPage() {
  const [contactsText, setContactsText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [waitSeconds, setWaitSeconds] = useState(180);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const [openedContacts, setOpenedContacts] = useState<string[]>([]);

  const whatsappWindow = useRef<Window | null>(null);

  const contacts = useMemo(() => {
    const cleanContacts = contactsText
      .split("\n")
      .map((item) => item.replace(/\D/g, "").trim())
      .filter((item) => item.length >= 10);

    return Array.from(new Set(cleanContacts));
  }, [contactsText]);

  const duplicatedCount = useMemo(() => {
    const cleanContacts = contactsText
      .split("\n")
      .map((item) => item.replace(/\D/g, "").trim())
      .filter((item) => item.length >= 10);

    return cleanContacts.length - new Set(cleanContacts).size;
  }, [contactsText]);

  const currentContact = contacts[currentIndex];
  const progress =
    contacts.length > 0 ? Math.round((openedContacts.length / contacts.length) * 100) : 0;

  function playSound() {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
    );
    audio.play().catch(() => {});
  }

  function formatPhone(phone: string) {
    if (phone.startsWith("55")) return phone;
    return `55${phone}`;
  }

  function openWhatsapp(phone: string) {
    const finalPhone = formatPhone(phone);
    const url = `https://wa.me/${finalPhone}`;

    if (!whatsappWindow.current || whatsappWindow.current.closed) {
      whatsappWindow.current = window.open(url, "whatsapp_leads");
    } else {
      whatsappWindow.current.location.href = url;
      whatsappWindow.current.focus();
    }

    setOpenedContacts((prev) =>
      prev.includes(phone) ? prev : [...prev, phone]
    );
  }

  function startSending() {
    if (!contacts.length) {
      alert("Informe pelo menos um contato válido.");
      return;
    }

    setStarted(true);
    setRunning(false);
    setWaitingConfirmation(true);
    setCurrentIndex(0);
    setSecondsLeft(waitSeconds);
    setOpenedContacts([]);
    playSound();
  }

  function confirmOpenContact() {
    if (!currentContact) return;

    openWhatsapp(currentContact);
    setWaitingConfirmation(false);
    setRunning(true);
    setSecondsLeft(waitSeconds);
  }

  function pauseSending() {
    setRunning(false);
  }

  function continueSending() {
    setRunning(true);
  }

  function resetSending() {
    setRunning(false);
    setStarted(false);
    setWaitingConfirmation(false);
    setCurrentIndex(0);
    setSecondsLeft(waitSeconds);
    setOpenedContacts([]);
  }

  function prepareNextContact() {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= contacts.length) {
      setRunning(false);
      setStarted(false);
      setWaitingConfirmation(false);
      playSound();
      alert("Todos os contatos da lista foram abertos.");
      return;
    }

    setCurrentIndex(nextIndex);
    setRunning(false);
    setWaitingConfirmation(true);
    setSecondsLeft(waitSeconds);
    playSound();
  }

  useEffect(() => {
    setSecondsLeft(waitSeconds);
  }, [waitSeconds]);

  useEffect(() => {
    if (!running || !started || waitingConfirmation) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(prepareNextContact, 300);
          return waitSeconds;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running, started, waitingConfirmation, currentIndex, contacts, waitSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-2xl">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-green-400">
            Automação manual
          </p>

          <h1 className="text-3xl font-black md:text-5xl">
            Envio de Leads pelo WhatsApp
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Cole sua lista de contatos, escolha o intervalo e abra um lead por vez
            com confirmação manual. O sistema remove duplicados automaticamente.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card title="Leads válidos" value={contacts.length} />
          <Card title="Já abertos" value={openedContacts.length} />
          <Card title="Duplicados removidos" value={duplicatedCount} />
          <Card title="Progresso" value={`${progress}%`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-5 shadow-xl">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <label className="block text-sm font-black text-white">
                  Lista de contatos
                </label>
                <p className="text-xs text-zinc-500">
                  Um número por linha. Duplicados são ignorados.
                </p>
              </div>

              <select
                value={waitSeconds}
                onChange={(e) => setWaitSeconds(Number(e.target.value))}
                disabled={started}
                className="h-11 rounded-2xl border border-white/10 bg-zinc-950 px-4 text-sm font-bold text-white outline-none"
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Intervalo: {option.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              disabled={started}
              className="h-[420px] w-full resize-none rounded-3xl border border-white/10 bg-zinc-950 p-5 text-sm leading-7 text-white outline-none transition placeholder:text-zinc-700 focus:border-green-500"
            />

            <div className="mt-4 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
              Use apenas contatos que você tem permissão para abordar. Essa tela
              não envia mensagem automática, apenas abre a conversa do WhatsApp.
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-5 shadow-xl">
            <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-5 text-center">
              <p className="text-sm font-bold text-green-300">
                {waitingConfirmation ? "Contato pronto para abrir" : "Próximo contato em"}
              </p>

              <strong className="mt-3 block text-5xl font-black text-green-400">
                {waitingConfirmation
                  ? "PRONTO"
                  : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
              </strong>

              <p className="mt-3 text-sm text-zinc-300">
                {currentContact || "Nenhum contato selecionado"}
              </p>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-950">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5 space-y-3">
              <Info label="Status" value={getStatus(running, started, waitingConfirmation)} />
              <Info label="Contato atual" value={contacts.length ? currentIndex + 1 : 0} />
              <Info label="Total da lista" value={contacts.length} />
              <Info label="Intervalo" value={`${waitSeconds / 60} min`} />
            </div>

            <div className="mt-6 grid gap-3">
              {!started && (
                <button
                  onClick={startSending}
                  className="h-12 rounded-2xl bg-green-600 font-black text-white transition hover:bg-green-500"
                >
                  Iniciar
                </button>
              )}

              {waitingConfirmation && started && (
                <button
                  onClick={confirmOpenContact}
                  className="h-12 rounded-2xl bg-green-600 font-black text-white transition hover:bg-green-500"
                >
                  Abrir contato no WhatsApp
                </button>
              )}

              {started && running && (
                <button
                  onClick={pauseSending}
                  className="h-12 rounded-2xl bg-yellow-500 font-black text-zinc-950 transition hover:bg-yellow-400"
                >
                  Pausar contador
                </button>
              )}

              {started && !running && !waitingConfirmation && (
                <button
                  onClick={continueSending}
                  className="h-12 rounded-2xl bg-blue-600 font-black text-white transition hover:bg-blue-500"
                >
                  Continuar contador
                </button>
              )}

              {started && (
                <button
                  onClick={prepareNextContact}
                  className="h-12 rounded-2xl border border-white/10 bg-white/5 font-black text-white transition hover:bg-white/10"
                >
                  Pular para próximo
                </button>
              )}

              <button
                onClick={resetSending}
                className="h-12 rounded-2xl border border-red-500/20 bg-red-500/10 font-black text-red-200 transition hover:bg-red-500/20"
              >
                Resetar
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <strong className="mt-2 block text-3xl font-black text-white">
        {value}
      </strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm">
      <span className="text-zinc-400">{label}</span>
      <strong className="text-white">{value}</strong>
    </div>
  );
}

function getStatus(
  running: boolean,
  started: boolean,
  waitingConfirmation: boolean
) {
  if (!started) return "Parado";
  if (waitingConfirmation) return "Aguardando confirmação";
  if (running) return "Contando";
  return "Pausado";
}