"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

/** Stitch search pill: submit → /search, mic → Web Speech API voice search. */
export function SearchBar({ defaultValue = "", placeholder = "Search 200,000+ authentic items...", autoFocus }: { defaultValue?: string; placeholder?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => setQ(defaultValue), [defaultValue]);

  const go = (value: string) => {
    const term = value.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  const startVoice = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      toast("Voice search isn't supported in this browser", "info");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    // en-IN is widely supported by Chrome's speech service and suits Pakistani English
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setQ(text);
      go(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast("Allow microphone access in your browser to use voice search", "error");
      } else if (e.error === "no-speech" || e.error === "aborted") {
        toast("Didn't catch that — tap the mic and speak again", "info");
      } else if (e.error === "network") {
        toast("Voice search needs an internet connection", "error");
      } else {
        toast("Couldn't hear that — please try again", "error");
      }
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      className="relative flex items-center w-full bg-surface-container-lowest rounded-full shadow-sm"
    >
      <Icon name="search" className="absolute left-4 text-[20px] text-secondary" />
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        aria-label="Search products"
        className="w-full h-12 pl-12 pr-20 bg-transparent rounded-full font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none"
        placeholder={placeholder}
      />
      <div className="absolute right-2 flex items-center gap-1 pr-1">
        {q ? (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-on-surface">
            <Icon name="close" className="text-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            title="Scan or search by image"
            aria-label="Search by image"
            onClick={() => toast("Visual search is coming soon", "info")}
            className="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-colors"
          >
            <Icon name="photo_camera" className="text-[19px]" />
          </button>
        )}
        <button
          type="button"
          title="Voice search"
          aria-label={listening ? "Stop voice search" : "Voice search"}
          onClick={startVoice}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${listening ? "text-on-primary bg-primary animate-pulse" : "text-secondary hover:text-primary"}`}
        >
          <Icon name="mic" className="text-[19px]" />
        </button>
      </div>
    </form>
  );
}
