import type { ReactNode } from 'react';
import styles from './goods-workspace.module.css';

export default function GoodsWorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className={styles.workspace}>{children}</div>;
}
