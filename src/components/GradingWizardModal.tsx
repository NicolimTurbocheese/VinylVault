import React, { useState } from "react";
import { X, Sparkles, ArrowLeft } from "lucide-react";
import { GoldmineGrade } from "../types";
import { MEDIA_QUESTIONS, SLEEVE_QUESTIONS, scoreToGrade, WizardMode } from "../utils/gradingWizard";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

interface GradingWizardModalProps {
  isOpen: boolean;
  mode: WizardMode;
  onClose: () => void;
  onApply: (grade: GoldmineGrade) => void;
}

const gradeLabel = (g: GoldmineGrade) => (g === "F_P" ? "Fair/Poor" : g);

export const GradingWizardModal: React.FC<GradingWizardModalProps> = ({ isOpen, mode, onClose, onApply }) => {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  useEscapeToClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const questions = mode === "media" ? MEDIA_QUESTIONS : SLEEVE_QUESTIONS;
  const isDone = step >= questions.length;
  const result = isDone ? scoreToGrade(scores.reduce((a, b) => a + b, 0)) : null;

  const reset = () => {
    setStep(0);
    setScores([]);
  };

  const handleAnswer = (score: number) => {
    setScores((prev) => {
      const next = [...prev];
      next[step] = score;
      return next;
    });
    setStep((s) => s + 1);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={handleClose}>
      <div
        className="relative w-full max-w-lg rounded-xl bg-[#FAF8F3] border border-[#E2DCD0] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E2DCD0] bg-[#EFEAE0]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#A94A42]/10 text-[#A94A42] border border-[#A94A42]/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#2B2B2B]">
              Grading Wizard — {mode === "media" ? "Media" : "Sleeve"}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md text-[#6B655B] hover:text-[#2B2B2B] hover:bg-[#E2DCD0] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 font-sans">
          {!isDone ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A94A42]">
                  Question {step + 1} of {questions.length}
                </span>
                {step > 0 && (
                  <button
                    onClick={() => setStep((s) => s - 1)}
                    className="text-[10px] font-bold uppercase tracking-wider text-[#6B655B] hover:text-[#2B2B2B] flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>
                )}
              </div>
              <div className="w-full h-1 rounded-full bg-[#EFEAE0] mb-5 overflow-hidden">
                <div
                  className="h-full bg-[#A94A42] transition-all"
                  style={{ width: `${(step / questions.length) * 100}%` }}
                />
              </div>
              <p className="text-sm font-bold text-[#2B2B2B] mb-4 leading-relaxed">{questions[step].prompt}</p>
              <div className="space-y-2">
                {questions[step].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt.score)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-[#D8D0C0] bg-white hover:border-[#A94A42]/50 hover:bg-[#EFEAE0] transition text-xs text-[#2B2B2B] cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A94A42] block">Suggested Grade</span>
              <div className="text-5xl font-serif font-bold text-[#A94A42]">{gradeLabel(result!)}</div>
              <p className="text-[11px] text-[#6B655B] leading-relaxed max-w-sm mx-auto">
                Based on your answers. This is a starting-point guideline reflecting the cumulative effect of what you
                described — not a substitute for hands-on expert grading, especially for a borderline call between
                adjacent grades.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={reset}
                  className="px-4 py-2 rounded-md border border-[#D8D0C0] text-xs font-bold text-[#6B655B] hover:bg-[#EFEAE0] transition cursor-pointer"
                >
                  Start Over
                </button>
                <button
                  onClick={() => {
                    onApply(result!);
                    handleClose();
                  }}
                  className="px-5 py-2.5 rounded-md bg-[#A94A42] hover:bg-[#8E3E37] text-white text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
                >
                  Use This Grade
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
