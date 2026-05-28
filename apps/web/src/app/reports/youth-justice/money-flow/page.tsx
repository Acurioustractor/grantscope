import { MoneyFlowScrollytelling } from './scrollytelling';

export const metadata = {
  title: 'Where the youth justice money lands · CivicGraph',
  description:
    'A scroll-driven investigation of $19 billion in Australian youth justice spending over 17 years. Reactive vs prevention. State-by-state. The drain at every layer.',
};

export default function YouthJusticeMoneyFlowPage() {
  return <MoneyFlowScrollytelling />;
}
