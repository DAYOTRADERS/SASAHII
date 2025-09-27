import { localize } from '@deriv-com/translations';

export type TSidebarItem = {
    label: string;
    content: { data: string; faq_id?: string }[];
    link: boolean;
};

// Return empty array - no tutorial/help content will be displayed
export const SIDEBAR_INTRO = (): TSidebarItem[] => [];