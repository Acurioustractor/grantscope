'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AnswerAutocomplete } from '@/app/components/answer-autocomplete';

const CATEGORIES = ['all', 'mission', 'capacity', 'impact', 'budget', 'governance', 'partners'] as const;

interface Answer {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[];
  source_application: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export function AnswerBankClient() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formQuestion, setFormQuestion] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSource, setFormSource] = useState('');
  const [saving, setSaving] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // AI extract state
  const [showAiImport, setShowAiImport] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{ extracted: number; inserted: number } | null>(null);
  const [extractUrl, setExtractUrl] = useState('');

  const fetchAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/answers?category=${activeCategory}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
      const data = await res.json();
      setAnswers(data.answers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load answers');
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchAnswers();
  }, [fetchAnswers]);

  async function handleSave() {
    if (!formQuestion.trim() || !formAnswer.trim()) return;
    setSaving(true);

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? { id: editingId, question: formQuestion, answer: formAnswer, category: formCategory || null }
        : { question: formQuestion, answer: formAnswer, category: formCategory || null, source_application: formSource || null };

      const res = await fetch('/api/answers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error((await res.json()).error);

      resetForm();
      fetchAnswers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this answer?')) return;
    try {
      await fetch(`/api/answers?id=${id}`, { method: 'DELETE' });
      fetchAnswers();
    } catch {
      // ignore
    }
  }

  async function handleImport() {
    // Parse Q&A pairs separated by blank lines
    // Format: Q: question\nA: answer
    const pairs = importText.split(/\n\s*\n/).filter(Boolean);
    let imported = 0;

    for (const pair of pairs) {
      const qMatch = pair.match(/^Q:\s*(.+)/im);
      const aMatch = pair.match(/^A:\s*([\s\S]+)/im);
      if (qMatch && aMatch) {
        try {
          await fetch('/api/answers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: qMatch[1].trim(),
              answer: aMatch[1].trim(),
              source_application: 'Imported',
            }),
          });
          imported++;
        } catch {
          // continue
        }
      }
    }

    if (imported > 0) {
      setShowImport(false);
      setImportText('');
      fetchAnswers();
    }
  }

  async function handleAiFileExtract(file: File) {
    setExtracting(true);
    setExtractResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/answers/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setExtractResult({ extracted: data.extracted, inserted: data.inserted });
      fetchAnswers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleAiUrlExtract() {
    if (!extractUrl.trim()) return;
    setExtracting(true);
    setExtractResult(null);
    try {
      const formData = new FormData();
      formData.append('url', extractUrl.trim());
      const res = await fetch('/api/answers/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setExtractResult({ extracted: data.extracted, inserted: data.inserted });
      setExtractUrl('');
      fetchAnswers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  function startEdit(answer: Answer) {
    setEditingId(answer.id);
    setFormQuestion(answer.question);
    setFormAnswer(answer.answer);
    setFormCategory(answer.category || '');
    setFormSource(answer.source_application || '');
    setShowAdd(true);
  }

  function resetForm() {
    setShowAdd(false);
    setEditingId(null);
    setFormQuestion('');
    setFormAnswer('');
    setFormCategory('');
    setFormSource('');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-bauhaus-black">
            Answer Bank
          </h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            Reusable answers from past grant applications
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAiImport(!showAiImport); setShowImport(false); }}
            className="text-xs font-black uppercase tracking-widest px-4 py-2 border-3 border-bauhaus-black bg-bauhaus-red text-white hover:bg-bauhaus-black transition-colors"
          >
            AI Extract
          </button>
          <button
            onClick={() => { setShowImport(!showImport); setShowAiImport(false); }}
            className="text-xs font-black uppercase tracking-widest px-4 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => { resetForm(); setShowAdd(true); }}
            className="text-xs font-black uppercase tracking-widest text-white bg-bauhaus-blue px-4 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black transition-colors"
          >
            + Add Answer
          </button>
          <Link
            href="/profile/matches"
            className="text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:text-bauhaus-black border-3 border-bauhaus-black px-4 py-2"
          >
            Matches
          </Link>
        </div>
      </div>

      {error && (
        <div className="border-4 border-bauhaus-red bg-danger-light p-4">
          <p className="text-sm font-bold text-bauhaus-red">{error}</p>
        </div>
      )}

      {/* AI Extract panel */}
      {showAiImport && (
        <div className="border-4 border-bauhaus-red bg-white p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
            AI Document Extraction
          </h3>
          <p className="text-xs text-bauhaus-muted">
            Upload a past grant application (PDF, DOCX, TXT) or paste a URL. AI will extract Q&amp;A pairs automatically.
          </p>

          <div className="flex gap-3">
            <div
              className="flex-1 border-2 border-dashed border-bauhaus-black/30 p-6 text-center cursor-pointer hover:border-bauhaus-red hover:bg-bauhaus-red/5 transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.docx,.txt,.md';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleAiFileExtract(file);
                };
                input.click();
              }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleAiFileExtract(file);
              }}
            >
              {extracting ? (
                <p className="text-sm font-bold text-bauhaus-muted animate-pulse">Extracting Q&amp;A pairs...</p>
              ) : (
                <>
                  <p className="text-sm font-bold text-bauhaus-black">Drop a file here or click to browse</p>
                  <p className="text-[11px] text-bauhaus-muted mt-1">PDF, DOCX, Markdown, or plain text</p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-xs font-bold text-bauhaus-muted uppercase">or</span>
            <input
              type="url"
              value={extractUrl}
              onChange={e => setExtractUrl(e.target.value)}
              placeholder="https://example.com/grant-application"
              className="flex-1 border-3 border-bauhaus-black p-2 text-xs focus:outline-none focus:border-bauhaus-red"
              disabled={extracting}
            />
            <button
              onClick={handleAiUrlExtract}
              disabled={extracting || !extractUrl.trim()}
              className="text-xs font-black uppercase tracking-widest text-white bg-bauhaus-red px-4 py-2 border-3 border-bauhaus-black disabled:opacity-50"
            >
              Extract
            </button>
          </div>

          {extractResult && (
            <div className="bg-green-50 border-l-4 border-green-500 px-3 py-2 text-xs font-bold text-green-800">
              Found {extractResult.extracted} Q&amp;A pairs, added {extractResult.inserted} to your Answer Bank
            </div>
          )}

          <button
            onClick={() => { setShowAiImport(false); setExtractResult(null); }}
            className="text-xs font-black uppercase tracking-widest px-4 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black/5"
          >
            Close
          </button>
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="border-4 border-bauhaus-black bg-white p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
            Import Q&A Pairs
          </h3>
          <p className="text-xs text-bauhaus-muted">
            Paste Q&A pairs from old applications. Format each pair as:<br />
            Q: Your question here<br />
            A: Your answer here<br /><br />
            Separate pairs with blank lines.
          </p>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={8}
            placeholder="Q: Describe your organisation's mission&#10;A: Our mission is to..."
            className="w-full border-3 border-bauhaus-black p-3 text-sm focus:outline-none focus:border-bauhaus-blue"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="text-xs font-black uppercase tracking-widest text-white bg-bauhaus-blue px-4 py-2 border-3 border-bauhaus-black disabled:opacity-50"
            >
              Import
            </button>
            <button
              onClick={() => { setShowImport(false); setImportText(''); }}
              className="text-xs font-black uppercase tracking-widest px-4 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showAdd && (
        <div className="border-4 border-bauhaus-blue bg-white p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-bauhaus-black">
            {editingId ? 'Edit Answer' : 'New Answer'}
          </h3>
          <input
            type="text"
            value={formQuestion}
            onChange={e => setFormQuestion(e.target.value)}
            placeholder="Question (e.g., Describe your organisation's capacity)"
            className="w-full border-3 border-bauhaus-black p-3 text-sm focus:outline-none focus:border-bauhaus-blue"
          />
          <AnswerAutocomplete
            value={formAnswer}
            onChange={setFormAnswer}
            placeholder="Your answer..."
            rows={6}
          />
          <div className="flex gap-3">
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="border-3 border-bauhaus-black px-3 py-2 text-xs font-bold uppercase focus:outline-none"
            >
              <option value="">Category</option>
              {CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {!editingId && (
              <input
                type="text"
                value={formSource}
                onChange={e => setFormSource(e.target.value)}
                placeholder="Source application (optional)"
                className="flex-1 border-3 border-bauhaus-black p-2 text-xs focus:outline-none focus:border-bauhaus-blue"
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !formQuestion.trim() || !formAnswer.trim()}
              className="text-xs font-black uppercase tracking-widest text-white bg-bauhaus-blue px-4 py-2 border-3 border-bauhaus-black disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="text-xs font-black uppercase tracking-widest px-4 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 border-4 border-bauhaus-black bg-white overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
              activeCategory === cat
                ? 'bg-bauhaus-black text-white'
                : 'text-bauhaus-black hover:bg-bauhaus-black/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Answers list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[20vh]">
          <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
            Loading answers...
          </div>
        </div>
      ) : answers.length === 0 ? (
        <div className="border-4 border-bauhaus-black/20 p-8 text-center">
          <p className="text-sm text-bauhaus-muted">
            No answers yet. Add answers from past applications to speed up future ones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {answers.map(answer => (
            <div key={answer.id} className="border-4 border-bauhaus-black bg-white">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-bauhaus-black">{answer.question}</h3>
                    <p className="text-xs text-bauhaus-black/70 mt-2 whitespace-pre-wrap line-clamp-4">
                      {answer.answer}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex gap-1">
                    <button
                      onClick={() => startEdit(answer)}
                      className="p-1.5 border-2 border-bauhaus-black/20 text-bauhaus-black/40 hover:border-bauhaus-blue hover:text-bauhaus-blue transition-colors"
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(answer.id)}
                      className="p-1.5 border-2 border-bauhaus-black/20 text-bauhaus-black/40 hover:border-bauhaus-red hover:text-bauhaus-red transition-colors"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  {answer.category && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue border border-bauhaus-blue/30 px-2 py-0.5">
                      {answer.category}
                    </span>
                  )}
                  {answer.source_application && (
                    <span className="text-[10px] text-bauhaus-muted">
                      From: {answer.source_application}
                    </span>
                  )}
                  {answer.use_count > 0 && (
                    <span className="text-[10px] text-bauhaus-muted">
                      Used {answer.use_count}x
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
