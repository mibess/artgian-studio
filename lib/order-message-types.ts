export type OrderMessageSender = "customer" | "seller";

export type OrderMessage = {
  id: number;
  sender: OrderMessageSender;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type OrderMessageThread = {
  order: { id: string; customerName: string };
  item: { id: number; productName: string; color: string; personalization: string | null; quantity: number };
  messages: OrderMessage[];
  hasMore: boolean;
};

export type OrderMessageInboxThread = {
  orderId: string;
  itemId: number;
  productName: string;
  color: string;
  customerName: string;
  lastBody: string;
  lastSender: OrderMessageSender;
  updatedAt: string;
  unreadCount: number;
};

export const ORDER_MESSAGE_MAX_LENGTH = 2000;
