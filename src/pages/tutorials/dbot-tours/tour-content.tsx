import React from 'react';
import { Localize } from '@deriv-com/translations';

type TJoyrideConfig = Record<
    'showProgress' | 'spotlightClicks' | 'disableBeacon' | 'disableOverlay' | 'disableCloseOnEsc',
    boolean
> & {
    placement?: 'bottom' | 'top' | 'left' | 'right';
};

const joyride_props: TJoyrideConfig = {
    showProgress: false,
    spotlightClicks: false,
    disableBeacon: true,
    disableOverlay: true,
    disableCloseOnEsc: true,
};

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

export const getTourDialogInfo = (is_mobile: boolean) => {
    return is_mobile ? (
        <Localize
            key='tour-dialog-info-mobile'
            i18n_default_text='Here’s a quick guide on how to use Deriv Bot on the go.'
        />
    ) : (
        <Localize key='tour-dialog-info-desktop' i18n_default_text='Learn how to build a bot with a simple strategy.' />
    );
};

export const getTourDialogAction = (is_mobile: boolean) => {
    if (is_mobile) {
        return (
            <Localize
                key='tour-dialog-action-mobile'
                i18n_default_text='You can import a bot from your mobile device or from Google drive, see a preview in the bot builder, and start trading by running the bot.'
            />
        );
    }
    return '';
};

export const onboarding_tour_header = (
    <Localize key='onboarding-tour-header' i18n_default_text='Welcome to Deriv Bot' />
);

export const getBotBuilderTourHeader = (is_mobile: boolean) => {
    if (is_mobile) {
        return <Localize key='tour_header-mobile' i18n_default_text='Bot Builder guide' />;
    }
    return <Localize key='tour_header-desktop' i18n_default_text="Let's build a Bot!" />;
};