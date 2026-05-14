import { Lock } from 'lucide-react';
import svgPaths from '../../../imports/Group265/svg-un0nwvbf78';
import styles from './DealBox.module.css';

export interface DealBoxProps {
  type: 'link' | 'text' | 'promo';
  title: string;
  description?: string;
  isLocked?: boolean;
  content?: string; // URL for link, text content, or promo code
  onUnlock?: () => void;
}

export default function DealBox({ 
  type, 
  title, 
  description, 
  isLocked = false, 
  content,
  onUnlock 
}: DealBoxProps) {
  
  const handleClick = () => {
    if (isLocked && onUnlock) {
      onUnlock();
    } else if (type === 'link' && content && !isLocked) {
      window.open(content, '_blank', 'noopener,noreferrer');
    }
  };

  const renderContent = () => {
    if (isLocked) {
      return (
        <div className={styles.lockedOverlay}>
          <Lock className={styles.lockIcon} size={40} />
          <p className={styles.lockedText}>Login to unlock</p>
        </div>
      );
    }

    switch (type) {
      case 'link':
        return (
          <div className={styles.linkContent}>
            <div className={styles.iconCircle}>
              <svg className={styles.arrowIcon} fill="none" preserveAspectRatio="none" viewBox="0 0 12.25 10.4924">
                <path d={svgPaths.p29e5f200} fill="black" />
              </svg>
            </div>
            <p className={styles.linkText}>{content || 'Go to the Website'}</p>
          </div>
        );
      
      case 'text':
        return (
          <div className={styles.textContent}>
            {description && <p className={styles.description}>{description}</p>}
          </div>
        );
      
      case 'promo':
        return (
          <div className={styles.promoContent}>
            {description && <p className={styles.promoDescription}>{description}</p>}
            <p className={styles.promoCode}>{content || 'XXX XXXX XXX'}</p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div 
      className={`${styles.dealBox} ${isLocked ? styles.locked : ''} ${type === 'link' ? styles.clickable : ''}`}
      onClick={handleClick}
      role={type === 'link' || isLocked ? 'button' : undefined}
      tabIndex={type === 'link' || isLocked ? 0 : undefined}
    >
      <h3 className={styles.title}>{title}</h3>
      {renderContent()}
    </div>
  );
}
