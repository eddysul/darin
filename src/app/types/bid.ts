export type BidStatus = 'pending' | 'interview_scheduled' | 'accepted' | 'rejected';

export type Bid = {
  id: string;
  caregiverId: string;
  caregiverName: string;
  caregiverAvatar: string;
  caregiverRole: string;
  parentId: number;
  price: string;
  message: string;
  status: BidStatus;
  submittedAt: string;
  interviewDate?: string;
};
