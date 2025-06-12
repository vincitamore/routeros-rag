'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { processHtmlContent } from '../../../utils/html-processor';
import styles from './Docs.module.css';

interface DocContent {
    title: string;
    content_type: 'html' | 'markdown';
    content_html?: string;
    content_processed?: string;
    images?: string[];
    attachments?: string[];
    html_text_content?: string;
}

export default function DocPage() {
    const params = useParams();
    const [content, setContent] = useState<DocContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContent = async () => {
            if (!params?.slug) {
                // Not ready yet, or no slug available
                return;
            }
            try {
                setLoading(true);
                const slug = Array.isArray(params.slug) ? params.slug.join('/') : params.slug;
                const response = await fetch(`/api/docs/${slug}`);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to fetch content: ${errorText || response.statusText}`);
                }
                
                const data = await response.json();
                setContent(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [params?.slug]);

    if (loading) return <div className={styles.loading}>Loading content...</div>;
    if (error) return <div className={styles.error}>Error: {error}</div>;
    if (!content) return <div className={styles.error}>Content not found.</div>;

    const renderContent = () => {
        if (content.content_type === 'html' && content.content_html) {
            // Process and sanitize HTML content
            const processedHtml = processHtmlContent(content.content_html, content.images || []);
            
            return (
                <div 
                    className={`${styles.prose} ${styles.htmlContent}`}
                    dangerouslySetInnerHTML={{ __html: processedHtml }}
                />
            );
        } else if (content.content_processed) {
            // Fallback to markdown rendering
            return (
                <div className={styles.prose}>
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                    >
                        {content.content_processed}
                    </ReactMarkdown>
                </div>
            );
        } else {
            return <div className={styles.error}>No content available.</div>;
        }
    };

    return (
        <article className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>{content.title}</h1>
                {content.content_type === 'html' && (
                    <div className={styles.contentInfo}>
                        <span className={styles.badge}>Enhanced HTML Content</span>
                        {content.images && content.images.length > 0 && (
                            <span className={styles.badge}>{content.images.length} Images</span>
                        )}
                        {content.attachments && content.attachments.length > 0 && (
                            <span className={styles.badge}>{content.attachments.length} Attachments</span>
                        )}
                    </div>
                )}
            </header>
            
            {renderContent()}
            
            {content.attachments && content.attachments.length > 0 && (
                <aside className={styles.attachments}>
                    <h3>Attachments</h3>
                    <ul>
                        {content.attachments.map((attachment, index) => (
                            <li key={index}>
                                <a 
                                    href={`/api/assets/${attachment}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.attachmentLink}
                                >
                                    {attachment.split('/').pop()}
                                </a>
                            </li>
                        ))}
                    </ul>
                </aside>
            )}
        </article>
    );
} 