import { getUser } from './users.mjs';

export function profileName(id) {
  return getUser(id).name;
}
