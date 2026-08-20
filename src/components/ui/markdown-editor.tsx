import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 5,
  className,
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div className={cn('rounded-lg border border-input overflow-hidden', className)}>
      <div className="flex items-center border-b border-border bg-secondary/30">
        <button
          type="button"
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'write'
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setTab('write')}
        >
          编写
        </button>
        <button
          type="button"
          className={cn(
            'px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'preview'
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setTab('preview')}
        >
          预览
        </button>
      </div>
      {tab === 'write' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="border-0 rounded-none min-h-20 max-h-64 resize-none overflow-y-auto field-sizing-fixed focus-visible:ring-0"
        />
      ) : (
        <div className="p-3 min-h-20 max-h-64 overflow-y-auto">
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <span className="text-sm text-muted-foreground">暂无内容</span>
          )}
        </div>
      )}
    </div>
  );
}
