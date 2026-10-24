import api from "@/lib/api-client";
import { takePrefetched } from "@/lib/prefetch";
import { ICurrentUser, IUser } from "@/features/user/types/user.types";

export async function getMyInfo(): Promise<ICurrentUser> {
  const early = await takePrefetched<ICurrentUser>("/users/me");
  if (early) return early;
  const req = await api.post<ICurrentUser>("/users/me");
  return req.data as ICurrentUser;
}

export async function updateUser(data: Partial<IUser>): Promise<IUser> {
  const req = await api.post<IUser>("/users/update", data);
  return req.data as IUser;
}
