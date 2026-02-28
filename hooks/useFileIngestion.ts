import React, { useState, useCallback } from 'react';

export interface IngestedFile {
  name: string;
  content: string; // Base64 for images, text for others
  type: string;
  mimeType: string;
}

export const useFileIngestion = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback(async (files: FileList) => {
    const newFiles: IngestedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      const filePromise = new Promise<IngestedFile>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          let content = result;
          
          if (file.type.startsWith('image/')) {
            // Strip the data:image/...;base64, part for Gemini inlineData
            content = result.split(',')[1];
          }
          
          resolve({
            name: file.name,
            content: content,
            type: file.type.startsWith('image/') ? 'image' : 'text',
            mimeType: file.type || 'text/plain'
          });
        };
        
        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
      
      newFiles.push(await filePromise);
    }
    
    setIngestedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const removeFile = (index: number) => {
    setIngestedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => setIngestedFiles([]);

  return {
    isDragging,
    ingestedFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removeFile,
    clearFiles
  };
};
