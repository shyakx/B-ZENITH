"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { changeOwnPinAction } from "@/actions/auth";
import { PinKeypad } from "@/components/auth/PinKeypad";
import { Button } from "@/components/ui/Button";
import { nextPinValue } from "@/lib/domain/pin-input";

export function ChangeOwnPinButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"new" | "confirm">("new");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep("new");
    setPin("");
    setFirst("");
    setError("");
    setDone("");
    setBusy(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function save(nextPin: string, confirmPin: string) {
    setBusy(true);
    const result = await changeOwnPinAction({ pin: nextPin, confirmPin });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setStep("new");
      setPin("");
      setFirst("");
      return;
    }
    setDone("PIN saved. Use it the next time you sign in.");
    setPin("");
    setFirst("");
    setStep("new");
  }

  function press(key: string) {
    setError("");
    setDone("");
    setPin((value) => nextPinValue(value, key));
  }

  async function continuePin() {
    if (pin.length < 4) return;
    if (step === "new") {
      setFirst(pin);
      setPin("");
      setStep("confirm");
      return;
    }
    await save(first, pin);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={
          className ??
          `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-2 border-zenith-border px-3 py-2 text-sm font-semibold text-zenith-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenith-gold ${
            compact ? "" : "w-full"
          }`
        }
      >
        <KeyRound size={15} />
        {compact ? "PIN" : "Change my PIN"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zenith-border bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-zenith-gold">Change my PIN</h2>
                <p className="mt-1 text-sm text-zenith-muted">
                  {step === "new" ? "Enter a new 4 to 6 digit PIN." : "Enter the same PIN again to confirm."}
                </p>
              </div>
              <button type="button" className="text-sm font-semibold text-zenith-gold" onClick={close}>
                Close
              </button>
            </div>
            <div className="mt-4 text-center text-3xl tracking-[0.35em] text-zenith-gold">
              {pin ? "•".repeat(pin.length) : "PIN"}
            </div>
            <div className="mt-3">
              <PinKeypad compact onKey={press} />
            </div>
            {error ? <p className="mt-3 text-center text-sm text-zenith-danger">{error}</p> : null}
            {done ? <p className="mt-3 text-center text-sm text-zenith-success">{done}</p> : null}
            <Button className="mt-4 w-full" disabled={pin.length < 4 || busy} onClick={continuePin}>
              {busy ? "Saving…" : step === "new" ? "Continue" : "Save PIN"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
