import {paramCase} from 'src/utils/change-case';

import {_id, _postTitles} from 'src/_mock/assets';

// ----------------------------------------------------------------------

const MOCK_ID = _id[1];

const MOCK_TITLE = _postTitles[2];

const ROOTS = {
  AUTH: '/auth',
  AUTH_DEMO: '/auth-demo',
  DASHBOARD: '/dashboard',
};

// ----------------------------------------------------------------------

export const paths = {
  comingSoon: '/coming-soon',
  maintenance: '/maintenance',
  pricing: '/pricing',
  payment: '/payment',
  about: '/about-us',
  contact: '/contact-us',
  faqs: '/faqs',
  page403: '/error/403',
  page404: '/error/404',
  page500: '/error/500',
  components: '/components',
  docs: 'https://docs.minimals.cc',
  changelog: 'https://docs.minimals.cc/changelog',
  zoneStore: 'https://mui.com/store/items/zone-landing-page/',
  minimalStore: 'https://mui.com/store/items/minimal-dashboard/',
  freeUI: 'https://mui.com/store/items/minimal-dashboard-free/',
  figma: 'https://www.figma.com/design/cAPz4pYPtQEXivqe11EcDE/%5BPreview%5D-Minimal-Web.v6.0.0',
  product: {
    root: `/product`,
    checkout: `/product/checkout`,
    details: (id: string) => `/product/${id}`,
    demo: {details: `/product/${MOCK_ID}`},
  },
  post: {
    root: `/post`,
    details: (title: string) => `/post/${paramCase(title)}`,
    demo: {details: `/post/${paramCase(MOCK_TITLE)}`},
  },
  // AUTH
  auth: {
    amplify: {
      signIn: `${ROOTS.AUTH}/amplify/sign-in`,
      verify: `${ROOTS.AUTH}/amplify/verify`,
      signUp: `${ROOTS.AUTH}/amplify/sign-up`,
      updatePassword: `${ROOTS.AUTH}/amplify/update-password`,
      resetPassword: `${ROOTS.AUTH}/amplify/reset-password`,
    },
    jwt: {
      signIn: `${ROOTS.AUTH}/jwt/sign-in`,
      signUp: `${ROOTS.AUTH}/jwt/sign-up`,
    },
    firebase: {
      signIn: `${ROOTS.AUTH}/firebase/sign-in`,
      verify: `${ROOTS.AUTH}/firebase/verify`,
      signUp: `${ROOTS.AUTH}/firebase/sign-up`,
      resetPassword: `${ROOTS.AUTH}/firebase/reset-password`,
    },
    auth0: {
      signIn: `${ROOTS.AUTH}/auth0/sign-in`,
    },
    supabase: {
      signIn: `${ROOTS.AUTH}/supabase/sign-in`,
      verify: `${ROOTS.AUTH}/supabase/verify`,
      signUp: `${ROOTS.AUTH}/supabase/sign-up`,
      updatePassword: `${ROOTS.AUTH}/supabase/update-password`,
      resetPassword: `${ROOTS.AUTH}/supabase/reset-password`,
    },
  },
  authDemo: {
    split: {
      signIn: `${ROOTS.AUTH_DEMO}/split/sign-in`,
      signUp: `${ROOTS.AUTH_DEMO}/split/sign-up`,
      resetPassword: `${ROOTS.AUTH_DEMO}/split/reset-password`,
      updatePassword: `${ROOTS.AUTH_DEMO}/split/update-password`,
      verify: `${ROOTS.AUTH_DEMO}/split/verify`,
    },
    centered: {
      signIn: `${ROOTS.AUTH_DEMO}/centered/sign-in`,
      signUp: `${ROOTS.AUTH_DEMO}/centered/sign-up`,
      resetPassword: `${ROOTS.AUTH_DEMO}/centered/reset-password`,
      updatePassword: `${ROOTS.AUTH_DEMO}/centered/update-password`,
      verify: `${ROOTS.AUTH_DEMO}/centered/verify`,
    },
  },
  // DASHBOARD
  dashboard: {
    root: `${ROOTS.DASHBOARD}/assistant`,
    mail: `${ROOTS.DASHBOARD}/mail`,
    chat: `${ROOTS.DASHBOARD}/chat`,
    assistant: `${ROOTS.DASHBOARD}/assistant`,
    profile: `${ROOTS.DASHBOARD}/profile`,
    blank: `${ROOTS.DASHBOARD}/blank`,
    kanban: `${ROOTS.DASHBOARD}/kanban`,
    calendar: `${ROOTS.DASHBOARD}/calendar`,
    builder: `${ROOTS.DASHBOARD}/builder`,
    fileManager: `${ROOTS.DASHBOARD}/file-manager`,
    permission: `${ROOTS.DASHBOARD}/permission`,
    health: `${ROOTS.DASHBOARD}/health`,
    mealPlanning: `${ROOTS.DASHBOARD}/meal-planning`,
    mealPlanningHistory: `${ROOTS.DASHBOARD}/meal-planning/history`,
    ridesharing: `${ROOTS.DASHBOARD}/ridesharing`,
    friends: `${ROOTS.DASHBOARD}/friends`,
    city: {
      root: `${ROOTS.DASHBOARD}/city`,
      restaurants: `${ROOTS.DASHBOARD}/city/restaurants`,
      events: `${ROOTS.DASHBOARD}/city/events`,
      orders: `${ROOTS.DASHBOARD}/city/orders`,
      publicTransit: `${ROOTS.DASHBOARD}/city/public-transit`,
      restaurant: {
        new: `${ROOTS.DASHBOARD}/city/restaurant/new`,
        details: (id: string) => `${ROOTS.DASHBOARD}/city/restaurant/${id}`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/city/restaurant/${id}/edit`,
      },
      event: {
        new: `${ROOTS.DASHBOARD}/city/event/new`,
        details: (id: string) => `${ROOTS.DASHBOARD}/city/event/${id}`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/city/event/${id}/edit`,
      },
      order: {
        details: (id: string) => `${ROOTS.DASHBOARD}/city/order/${id}`,
      },
    },
    businessOwner: {
      root: `${ROOTS.DASHBOARD}/business-owner`,
      overview: `${ROOTS.DASHBOARD}/business-owner/overview`,
      orders: `${ROOTS.DASHBOARD}/business-owner/orders`,
      settings: `${ROOTS.DASHBOARD}/business-owner/settings`,
      // Restaurant-specific paths
      menu: `${ROOTS.DASHBOARD}/business-owner/menu`,
      menuItem: {
        new: `${ROOTS.DASHBOARD}/business-owner/menu/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/business-owner/menu/${id}/edit`,
      },
      // Event-specific paths
      events: `${ROOTS.DASHBOARD}/business-owner/events`,
      event: {
        new: `${ROOTS.DASHBOARD}/business-owner/events/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/business-owner/events/${id}/edit`,
      },
      // Transit-specific paths
      routes: `${ROOTS.DASHBOARD}/business-owner/routes`,
      route: {
        new: `${ROOTS.DASHBOARD}/business-owner/routes/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/business-owner/routes/${id}/edit`,
      },
    },
    general: {
      app: `${ROOTS.DASHBOARD}/app`,
      ecommerce: `${ROOTS.DASHBOARD}/ecommerce`,
      analytics: `${ROOTS.DASHBOARD}/analytics`,
      banking: `${ROOTS.DASHBOARD}/banking`,
      booking: `${ROOTS.DASHBOARD}/booking`,
      file: `${ROOTS.DASHBOARD}/file`,
      course: `${ROOTS.DASHBOARD}/course`,
      liiveDomains: `${ROOTS.DASHBOARD}/liive-domains`,
    },
    user: {
      root: `${ROOTS.DASHBOARD}/user`,
      new: `${ROOTS.DASHBOARD}/user/new`,
      list: `${ROOTS.DASHBOARD}/user/list`,
      cards: `${ROOTS.DASHBOARD}/user/cards`,
      profile: `${ROOTS.DASHBOARD}/user/profile`,
      account: `${ROOTS.DASHBOARD}/user/account`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/user/${id}/edit`,
      demo: {
        edit: `${ROOTS.DASHBOARD}/user/${MOCK_ID}/edit`,
      },
    },
    product: {
      root: `${ROOTS.DASHBOARD}/product`,
      new: `${ROOTS.DASHBOARD}/product/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/product/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/product/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/product/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/product/${MOCK_ID}/edit`,
      },
    },
    invoice: {
      root: `${ROOTS.DASHBOARD}/invoice`,
      new: `${ROOTS.DASHBOARD}/invoice/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/invoice/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/invoice/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/invoice/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/invoice/${MOCK_ID}/edit`,
      },
    },
    post: {
      root: `${ROOTS.DASHBOARD}/post`,
      new: `${ROOTS.DASHBOARD}/post/new`,
      details: (title: string) => `${ROOTS.DASHBOARD}/post/${paramCase(title)}`,
      edit: (title: string) => `${ROOTS.DASHBOARD}/post/${paramCase(title)}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/post/${paramCase(MOCK_TITLE)}`,
        edit: `${ROOTS.DASHBOARD}/post/${paramCase(MOCK_TITLE)}/edit`,
      },
    },
    order: {
      root: `${ROOTS.DASHBOARD}/order`,
      details: (id: string) => `${ROOTS.DASHBOARD}/order/${id}`,
      demo: {
        details: `${ROOTS.DASHBOARD}/order/${MOCK_ID}`,
      },
    },
    job: {
      root: `${ROOTS.DASHBOARD}/job`,
      new: `${ROOTS.DASHBOARD}/job/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/job/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/job/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/job/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/job/${MOCK_ID}/edit`,
      },
    },
    tour: {
      root: `${ROOTS.DASHBOARD}/tour`,
      new: `${ROOTS.DASHBOARD}/tour/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/tour/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/tour/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/tour/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/tour/${MOCK_ID}/edit`,
      },
    },
    hijra: {
      root: `${ROOTS.DASHBOARD}/hijra`,
      new: `${ROOTS.DASHBOARD}/hijra/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/hijra/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/hijra/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/hijra/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/hijra/${MOCK_ID}/edit`,
      },
    },
    // Add hajj routes
    hajj: {
      root: `${ROOTS.DASHBOARD}/hajj`,
      new: `${ROOTS.DASHBOARD}/hajj/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/hajj/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/hajj/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/hajj/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/hajj/${MOCK_ID}/edit`,
      },
    },
    // Add banking routes
    banking: {
      root: `${ROOTS.DASHBOARD}/banking`,
      accounts: `${ROOTS.DASHBOARD}/banking/accounts`,
      cards: `${ROOTS.DASHBOARD}/banking/cards`,
      transactions: `${ROOTS.DASHBOARD}/banking/transactions`,
      account: {
        new: `${ROOTS.DASHBOARD}/banking/account/new`,
        details: (id: string) => `${ROOTS.DASHBOARD}/banking/account/${id}`,
      },
      card: {
        new: `${ROOTS.DASHBOARD}/banking/card/new`,
        details: (id: string) => `${ROOTS.DASHBOARD}/banking/card/${id}`,
      },
    },
    // Add news routes
    news: {
      root: `${ROOTS.DASHBOARD}/news`,
      details: (id: string) => `${ROOTS.DASHBOARD}/news/${id}`,
    },
  },
};
