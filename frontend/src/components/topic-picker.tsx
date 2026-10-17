"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTopics } from "@/hooks/queries";
import type { TopicSlug } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopicPickerProps {
  value: TopicSlug | "";
  onChange: (topic: TopicSlug) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

/** Required, no default. Topics come from GET /topics in fixed order. */
export function TopicPicker({ value, onChange, id, invalid, describedBy, className }: TopicPickerProps) {
  const { data: topics = [] } = useTopics();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TopicSlug)} required>
      <SelectTrigger
        id={id}
        aria-label="Topic"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn("min-w-40", className)}
      >
        <SelectValue placeholder="Pick a topic" />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {topics.map((topic) => (
          <SelectItem key={topic.slug} value={topic.slug}>
            {topic.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
