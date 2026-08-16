export type DarinIdentity = {
  realNameFromProvider: string;
  nickname: string;
  tag: string;
  darinId: string;
};

export type DarinIdentityInput = Omit<DarinIdentity, "darinId">;
