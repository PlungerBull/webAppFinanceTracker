import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (firstName = '', lastName = '') => {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};