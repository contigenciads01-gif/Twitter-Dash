import React, { useState, useRef } from "react";
import { Send, Clock, Plus, Trash2, Image, Video, Sparkles, AlertCircle, X } from "lucide-react";
import { api } from "../../services/api";

interface ScheduleFormProps {
  onPostCreated: () => void;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({ onPostCreated }) => {
  const [text, setText] = useState("");
  const [threadParts, setThreadParts] = useState<string[]>([]);
  const [isThreadMode, setIsThreadMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper de cálculo de caracteres estilo Twitter (URLs = 23 chars)
  const calculateTwitterLength = (str: string) => {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const withoutUrls = str.replace(urlRegex, "");
    const urls = str.match(urlRegex) || [];
    // URLs ocupam 23 caracteres na contagem oficial
    return withoutUrls.length + urls.length * 23;
  };

  const mainCharCount = calculateTwitterLength(text);
  const isMainValid = mainCharCount > 0 && mainCharCount <= 280;

  // Handlers para adicionar mídia
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);

    const isVideo = selected.some((f) => f.type.startsWith("video/"));
    if (isVideo && (selected.length > 1 || mediaFiles.length > 0)) {
      setError("Só é permitido enviar 1 vídeo por tweet (sem outras imagens).");
      return;
    }

    if (mediaFiles.length + selected.length > 4) {
      setError("Máximo de 4 imagens permitidas por tweet.");
      return;
    }

    const newFiles = [...mediaFiles, ...selected].slice(0, 4);
    setMediaFiles(newFiles);

    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setMediaPreviews(previews);
    setError(null);
  };

  const removeMedia = (index: number) => {
    const newFiles = [...mediaFiles];
    newFiles.splice(index, 1);
    setMediaFiles(newFiles);

    const newPreviews = [...mediaPreviews];
    newPreviews.splice(index, 1);
    setMediaPreviews(newPreviews);
  };

  // Handlers de thread
  const addThreadPart = () => {
    setThreadParts([...threadParts, ""]);
  };

  const updateThreadPart = (index: number, val: string) => {
    const updated = [...threadParts];
    updated[index] = val;
    setThreadParts(updated);
  };

  const removeThreadPart = (index: number) => {
    const updated = [...threadParts];
    updated.splice(index, 1);
    setThreadParts(updated);
  };

  // Atalhos de agendamento rápido
  const setQuickTime = (minutesAhead: number) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    // Formata YYYY-MM-DDTHH:mm para o input datetime-local
    const tzOffset = target.getTimezoneOffset() * 60000;
    const localISOTime = new Date(target.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledAt(localISOTime);
  };

  const setTomorrowAt = (hour: number) => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(hour, 0, 0, 0);
    const tzOffset = target.getTimezoneOffset() * 60000;
    const localISOTime = new Date(target.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledAt(localISOTime);
  };

  const handleSubmit = async (publishImmediately: boolean = false) => {
    setError(null);

    if (!isMainValid) {
      setError("O texto do tweet é obrigatório e não pode ultrapassar 280 caracteres.");
      return;
    }

    // Valida partes da thread
    if (isThreadMode && threadParts.length > 0) {
      for (let i = 0; i < threadParts.length; i++) {
        const len = calculateTwitterLength(threadParts[i]);
        if (len === 0 || len > 280) {
          setError(`A parte ${i + 2} da thread precisa conter texto válido até 280 caracteres.`);
          return;
        }
      }
    }

    let targetDateISO = new Date().toISOString();
    if (!publishImmediately) {
      if (!scheduledAt) {
        setError("Por favor, selecione uma data e horário para agendamento.");
        return;
      }
      const parsedDate = new Date(scheduledAt);
      if (parsedDate.getTime() <= Date.now() - 5000) {
        setError("A data de agendamento deve estar no futuro.");
        return;
      }
      targetDateISO = parsedDate.toISOString();
    }

    setIsSubmitting(true);

    try {
      // 1. Faz upload das mídias se houver
      let mediaPaths: string[] = [];
      if (mediaFiles.length > 0) {
        const formData = new FormData();
        mediaFiles.forEach((f) => formData.append("media", f));
        const uploadRes = await api.post("/posts/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        mediaPaths = uploadRes.data.mediaPaths || [];
      }

      // 2. Cria o agendamento
      const payload = {
        text,
        scheduledAt: targetDateISO,
        mediaPaths,
        threadParts: isThreadMode && threadParts.length > 0 ? threadParts : undefined
      };

      const res = await api.post("/posts", payload);

      // Se foi solicitado "Publicar agora", chama imediatamente a rota de disparo
      if (publishImmediately && res.data?.id) {
        await api.post(`/posts/${res.data.id}/publish-now`);
      }

      // Limpa formulário
      setText("");
      setThreadParts([]);
      setIsThreadMode(false);
      setMediaFiles([]);
      setMediaPreviews([]);
      setScheduledAt("");
      onPostCreated();
    } catch (err: any) {
      setError(err.message || "Erro ao criar agendamento de post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#121824] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-twitter-blue" />
          Compor Publicação
        </h2>
        <button
          type="button"
          onClick={() => {
            setIsThreadMode(!isThreadMode);
            if (!isThreadMode && threadParts.length === 0) {
              setThreadParts([""]);
            }
          }}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
            isThreadMode
              ? "bg-twitter-blue text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          {isThreadMode ? "Modo Thread Ativo" : "+ Modo Thread"}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800/40">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tweet Principal */}
      <div className="mt-4 space-y-2">
        <div className="relative">
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="O que está acontecendo no seu nicho? Digite seu post..."
            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-twitter-blue/40 focus:border-twitter-blue text-sm resize-none"
          />
          {/* Contador de caracteres dinâmico */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                mainCharCount > 280
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                  : mainCharCount > 260
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {mainCharCount}/280
            </span>
          </div>
        </div>

        {/* Previews de Mídia */}
        {mediaPreviews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {mediaPreviews.map((preview, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-black flex items-center justify-center">
                {mediaFiles[idx]?.type.startsWith("video/") ? (
                  <video src={preview} className="max-h-full max-w-full object-contain" />
                ) : (
                  <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Partes da Thread */}
      {isThreadMode && (
        <div className="mt-4 space-y-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Continuação da Thread (Fio)
          </div>
          {threadParts.map((part, index) => {
            const count = calculateTwitterLength(part);
            return (
              <div key={index} className="relative pl-4 border-l-2 border-twitter-blue/40 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                  <span>Tweet #{index + 2}</span>
                  <button
                    type="button"
                    onClick={() => removeThreadPart(index)}
                    className="text-rose-500 hover:text-rose-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={part}
                    onChange={(e) => updateThreadPart(index, e.target.value)}
                    placeholder={`Escreva a parte ${index + 2} da thread...`}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-twitter-blue/40 text-xs resize-none"
                  />
                  <span
                    className={`absolute bottom-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      count > 280
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {count}/280
                  </span>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addThreadPart}
            className="flex items-center gap-1.5 text-xs font-semibold text-twitter-blue hover:text-twitter-hover pt-1"
          >
            <Plus className="w-4 h-4" /> Adicionar outro tweet à thread
          </button>
        </div>
      )}

      {/* Controles de Agendamento e Mídia */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,video/mp4"
            multiple
            className="hidden"
            onChange={handleMediaSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Image className="w-4 h-4 text-twitter-blue" />
            <Video className="w-4 h-4 text-emerald-500" />
            <span>Mídia ({mediaFiles.length}/4)</span>
          </button>
        </div>

        {/* Data e Hora */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-twitter-blue"
          />
        </div>
      </div>

      {/* Atalhos Rápidos de Horário */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        <span className="font-medium mr-1">Atalhos:</span>
        <button
          type="button"
          onClick={() => setQuickTime(15)}
          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          +15 min
        </button>
        <button
          type="button"
          onClick={() => setQuickTime(60)}
          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          +1 hora
        </button>
        <button
          type="button"
          onClick={() => setTomorrowAt(10)}
          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Amanhã 10:00
        </button>
        <button
          type="button"
          onClick={() => setTomorrowAt(18)}
          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Amanhã 18:00
        </button>
      </div>

      {/* Botões de Ação */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isSubmitting || !isMainValid}
          onClick={() => handleSubmit(true)}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition-colors"
        >
          Publicar Agora
        </button>
        <button
          type="button"
          disabled={isSubmitting || !isMainValid}
          onClick={() => handleSubmit(false)}
          className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-twitter-blue hover:bg-twitter-hover text-white disabled:opacity-50 transition-colors shadow-sm shadow-twitter-blue/30"
        >
          <Send className="w-3.5 h-3.5" />
          {isSubmitting ? "Gravando..." : "Agendar Publicação"}
        </button>
      </div>
    </div>
  );
};
