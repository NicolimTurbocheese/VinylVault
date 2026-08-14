import React, { useState } from "react";
import { Cloud, CloudOff, Copy, Check, X, Link2, AlertTriangle, Loader2 } from "lucide-react";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

export type SyncStatus = "disabled" | "connecting" | "connected" | "error";

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAvailable: boolean;
  vaultCode: string | null;
  status: SyncStatus;
  errorMessage?: string | null;
  onCreateVault: () => void;
  onJoinVault: (code: string) => void;
  onDisableSync: () => void;
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  isAvailable,
  vaultCode,
  status,
  errorMessage,
  onCreateVault,
  onJoinVault,
  onDisableSync,
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!vaultCode) return;
    try {
      await navigator.clipboard.writeText(vaultCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable; ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] text-zinc-100 border border-[#8FA89B]/30 rounded-xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#8FA89B]/10 border border-[#8FA89B]/30 flex items-center justify-center text-[#8FA89B]">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-[#8FA89B]">
              Cross-Device Sync
            </h2>
            <p className="text-xs font-mono text-zinc-400">
              Link this device to a Vault Code to share your collection across browsers/devices.
            </p>
          </div>
        </div>

        {!isAvailable && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-700/40 text-amber-300 text-xs mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Sync isn't configured for this deployment yet. A Firebase project needs to be connected
              (set the <code className="font-mono">VITE_FIREBASE_*</code> environment variables) before this feature works.
            </span>
          </div>
        )}

        {isAvailable && vaultCode && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono">
              {status === "connected" && (
                <span className="flex items-center gap-1.5 text-[#8FA89B]">
                  <Cloud className="w-4 h-4" /> Connected — changes sync live
                </span>
              )}
              {status === "connecting" && (
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                </span>
              )}
              {status === "error" && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Sync error{errorMessage ? `: ${errorMessage}` : ""}
                </span>
              )}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">Your Vault Code</label>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 font-mono text-sm tracking-wide text-[#8FA89B] break-all">
                  {vaultCode}
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-[#8FA89B]/50 transition"
                  title="Copy code"
                >
                  {copied ? <Check className="w-4 h-4 text-[#8FA89B]" /> : <Copy className="w-4 h-4 text-zinc-300" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                Enter this exact code on another device (in this same Sync panel) to link its collection to this one.
                Anyone with this code can read and edit this collection, so keep it private like a password.
              </p>
            </div>

            <button
              onClick={onDisableSync}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-red-500/50 hover:text-red-400 text-zinc-300 text-xs font-bold transition"
            >
              <CloudOff className="w-4 h-4" />
              Stop Syncing This Device
            </button>
          </div>
        )}

        {isAvailable && !vaultCode && (
          <div className="space-y-5">
            <div>
              <button
                onClick={onCreateVault}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#8FA89B] text-black font-bold text-sm hover:bg-[#A3BFB1] transition"
              >
                <Cloud className="w-4 h-4" />
                Start Syncing (Generate a New Vault Code)
              </button>
              <p className="text-[11px] text-zinc-500 mt-2">
                Creates a fresh Vault Code and uploads your current collection to it. Use this on your first device.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px bg-zinc-800 flex-1" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">or</span>
              <div className="h-px bg-zinc-800 flex-1" />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">Join an Existing Vault</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Paste vault code..."
                  className="flex-1 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#8FA89B]/60"
                />
                <button
                  onClick={() => joinCodeInput.trim() && onJoinVault(joinCodeInput)}
                  disabled={!joinCodeInput.trim()}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-[#8FA89B]/50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-zinc-100 transition"
                >
                  <Link2 className="w-4 h-4" />
                  Join
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Enter the code shown on your other device. This device's local collection will be merged in.
              </p>
              {status === "error" && (
                <p className="text-[11px] text-red-400 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {errorMessage || "Couldn't join that vault."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
