import { User } from "./user.model";

export interface ListeningAndCreditTable {
  user: User;
  credit: Date;
  listening: string;
}