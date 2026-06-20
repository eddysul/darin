export type PaymentStatus = "pending" | "paid";

export type WeeklyPayment = {
  id: string;
  weekLabel: string;
  weekLabelKo: string;
  amount: string;
  dueDate: string;
  dueDateKo: string;
  status: PaymentStatus;
  paidAt?: string;
  caregiverName: string;
};
