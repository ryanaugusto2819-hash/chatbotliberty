import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { conversations, messages } from '@/data/mockData';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowLeft, Send, Smile, Paperclip, MoreVertical, Phone, User, Tag, Clock, CheckCheck, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  const conversation = conversations.find((c) => c.id === id);
  const chatMessages = messages.filter((m) => m.conversationId === id);

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Conversa não encontrada
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    setInput('');
  };

  return (
    <div className="flex h-screen">
      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Chat Header */}
        <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/conversations')} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {conversation.contactName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">{conversation.contactName}</p>
              <p className="text-[11px] text-muted-foreground">{conversation.contactPhone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={conversation.status} />
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin bg-background">
          {chatMessages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  msg.sender === 'agent'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card border border-border text-card-foreground rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender === 'agent' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  <span className="text-[10px]">{msg.timestamp}</span>
                  {msg.sender === 'agent' && (
                    msg.status === 'read' ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex items-end gap-2">
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                placeholder="Digite uma mensagem..."
                rows={1}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <Smile className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleSend}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Contact Info Sidebar */}
      <div className="hidden lg:flex w-72 flex-col border-l border-border bg-card">
        <div className="flex flex-col items-center py-8 px-4 border-b border-border">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground mb-3">
            {conversation.contactName.split(' ').map(n => n[0]).join('')}
          </div>
          <p className="text-sm font-semibold text-card-foreground">{conversation.contactName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{conversation.contactPhone}</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Informações</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-card-foreground">{conversation.assignedAgent || 'Não atribuído'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-card-foreground">Última msg: {conversation.lastMessageTime}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {conversation.tags.map(t => (
                <span key={t} className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Notas Internas</p>
            <textarea
              placeholder="Adicionar nota..."
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
