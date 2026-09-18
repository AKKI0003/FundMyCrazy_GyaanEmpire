import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Sparkles } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";

export function SetupScreen({ onGenerate, loading, error }) {
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const fileRef = useRef(null);

  const canSubmit = subject.trim() && (text.trim() || imageFile) && !loading;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{
        backgroundImage: "url(/game-art/sky-background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-xl"
      >
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-teal-dark mb-2">
            <Sparkles size={14} />
            Gyan Empire
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight mb-3">
            Turn your syllabus into an empire you build.
          </h1>
          <p className="text-muted text-base leading-relaxed max-w-md mx-auto">
            Upload a chapter or paste your notes. Every topic becomes a building — study it, and it grows.
            Ignore it, and it falls behind.
          </p>
        </div>

        <Card className="p-6 space-y-5 bg-white/95 backdrop-blur-sm shadow-lg">
          <div>
            <label className="block text-sm font-medium mb-1.5">Subject name</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Class 10 Chemistry" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Paste your syllabus or notes</label>
            <Textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste chapter names, topics, or full notes text here..."
            />
          </div>

          <div className="flex items-center gap-3">
            <img src="/game-art/divider.png" alt="" className="h-2 flex-1 object-cover opacity-70" />
            <span className="text-xs text-muted">or</span>
            <img src="/game-art/divider.png" alt="" className="h-2 flex-1 object-cover opacity-70" />
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted hover:border-teal hover:text-teal-dark transition-colors"
            >
              <Upload size={16} />
              {imageFile ? `Selected: ${imageFile.name}` : "Upload a photo of a textbook page"}
            </button>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            size="lg"
            className="w-full"
            disabled={!canSubmit}
            onClick={() => onGenerate({ subject, text, imageFile })}
          >
            {loading ? "Building your empire..." : "Build my empire"}
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}
