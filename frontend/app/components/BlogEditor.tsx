import React, { useRef, useEffect } from 'react';
import EditorJS from '@editorjs/editorjs';

// Dynamically import tools to avoid SSR issues
const Header = require('@editorjs/header');
const ImageTool = require('@editorjs/image');
const List = require('@editorjs/list');
const Quote = require('@editorjs/quote');

interface BlogEditorProps {
  initialData?: any;
  onChange?: (data: any) => void;
}

const BlogEditor: React.FC<BlogEditorProps> = ({ initialData, onChange }) => {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!editorRef.current) {
      editorRef.current = new EditorJS({
        holder: 'editorjs',
        data: initialData,
        autofocus: true,
        tools: {
          header: Header,
          image: ImageTool,
          list: List,
          quote: Quote,
        },
        onChange: async () => {
          if (onChange && editorRef.current) {
            const outputData = await editorRef.current.save();
            onChange(outputData);
          }
        },
      });
    }
    return () => {
      if (editorRef.current && editorRef.current.destroy) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // We only want to run this once on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id="editorjs" style={{ minHeight: 400, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 16 }} />;
};

export default BlogEditor; 