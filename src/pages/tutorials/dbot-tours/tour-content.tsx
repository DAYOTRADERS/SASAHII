import React from 'react';
import { Localize } from '@deriv-com/translations';

// Empty configurations to ensure no tour is shown
export const DBOT_ONBOARDING = [];

export const BOT_BUILDER_TOUR = [];

export type TMobileTourConfig = {
    header: React.ReactElement;
    content: Array<React.ReactElement>;
    tour_step_key: number;
    img?: string;
    media?: string;
};

export const BOT_BUILDER_MOBILE: TMobileTourConfig[] = [];

export const DBOT_ONBOARDING_MOBILE: TMobileTourConfig[] = [];

// Return empty elements to ensure nothing is displayed
export const getTourDialogInfo = () => null;

export const getTourDialogAction = () => null;

export const onboarding_tour_header = null;

export const getBotBuilderTourHeader = () => null;

// Export empty config to prevent any tour functionality
export const joyride_props = {
    showProgress: false,
    spotlightClicks: false,
    disableBeacon: true,
    disableOverlay: true,
    disableCloseOnEsc: true,
};