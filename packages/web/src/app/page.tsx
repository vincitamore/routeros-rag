import styles from './HomePage.module.css';
import FullPageChat from '@/components/full-page-chat';
import { SearchIcon, LightningIcon, BookIcon } from '@/components/icons';

export default function HomePage() {
  return (
    <div className={styles.container}>
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureHeader}>
              <SearchIcon size={24} className={styles.featureIcon} />
              <h3>Smart Search</h3>
            </div>
            <p>Ask questions in natural language and get precise answers from the RouterOS documentation</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureHeader}>
              <LightningIcon size={24} className={styles.featureIcon} />
              <h3>Instant Help</h3>
            </div>
            <p>Get configuration examples, troubleshooting tips, and best practices instantly</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureHeader}>
              <BookIcon size={24} className={styles.featureIcon} />
              <h3>Complete Coverage</h3>
            </div>
            <p>Access the entire RouterOS knowledge base with AI-enhanced search and explanations</p>
        </div>
      </div>
      <div className={styles.chatSection}>
        <FullPageChat />
      </div>
    </div>
  );
}
