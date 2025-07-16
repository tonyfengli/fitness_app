import React from "react";
import type { FeedbackSectionProps } from "./FeedbackSection.types";
import { cn } from "../../utils/cn";
import { Button } from "../Button";
import { Icon } from "../Icon";

export function FeedbackSection({
  feedback = [],
  isExpanded = true,
  onToggle,
  onAddNote,
  className,
}: FeedbackSectionProps) {
  return (
    <div className={cn(className)}>
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-6 text-left hover:bg-gray-50 transition-colors duration-200"
      >
        <span className="text-lg font-semibold text-gray-700">View Client Feedback</span>
        <Icon 
          name={isExpanded ? 'expand_less' : 'expand_more'} 
          className="text-gray-400"
        />
      </button>
      
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {feedback.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No feedback yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map((item) => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-gray-700">{item.text}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {item.author && `${item.author} • `}{item.date}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {onAddNote && (
            <Button
              onClick={onAddNote}
              variant="secondary"
              size="sm"
              className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center"
            >
              <Icon name="add_comment" size={16} className="mr-2" />
              <span>Add Note</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}