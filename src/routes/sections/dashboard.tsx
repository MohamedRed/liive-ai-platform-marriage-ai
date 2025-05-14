import {lazy, Suspense} from 'react';
import {Outlet} from 'react-router-dom';

import {CONFIG} from 'src/config-global';
import {DashboardLayout} from 'src/layouts/dashboard';

import {LoadingScreen} from 'src/components/loading-screen';

import {AuthGuard} from 'src/auth/guard';
import { OnboardingGuard } from 'src/auth/guard/onboarding-guard';
import { ReverseOnboardingGuard } from 'src/auth/guard/reverse-onboarding-guard';

// ----------------------------------------------------------------------

// Overview
const OverviewEcommercePage = lazy(() => import('src/pages/dashboard/ecommerce'));
const OverviewAnalyticsPage = lazy(() => import('src/pages/dashboard/analytics'));
const OverviewBankingPage = lazy(() => import('src/pages/dashboard/banking'));
const OverviewBookingPage = lazy(() => import('src/pages/dashboard/booking'));
const OverviewFilePage = lazy(() => import('src/pages/dashboard/file'));
const OverviewCoursePage = lazy(() => import('src/pages/dashboard/course'));
const LiiveDomainsPage = lazy(() => import('src/pages/dashboard/liive-domains'));
// Product
const ProductDetailsPage = lazy(() => import('src/pages/dashboard/product/details'));
const ProductListPage = lazy(() => import('src/pages/dashboard/product/list'));
const ProductCreatePage = lazy(() => import('src/pages/dashboard/product/new'));
const ProductEditPage = lazy(() => import('src/pages/dashboard/product/edit'));
// Order
const OrderListPage = lazy(() => import('src/pages/dashboard/order/list'));
const OrderDetailsPage = lazy(() => import('src/pages/dashboard/order/details'));
// Invoice
const InvoiceListPage = lazy(() => import('src/pages/dashboard/invoice/list'));
const InvoiceDetailsPage = lazy(() => import('src/pages/dashboard/invoice/details'));
const InvoiceCreatePage = lazy(() => import('src/pages/dashboard/invoice/new'));
const InvoiceEditPage = lazy(() => import('src/pages/dashboard/invoice/edit'));
// User
const UserProfilePage = lazy(() => import('src/pages/dashboard/user/profile'));
const UserCardsPage = lazy(() => import('src/pages/dashboard/user/cards'));
const UserListPage = lazy(() => import('src/pages/dashboard/user/list'));
const UserAccountPage = lazy(() => import('src/pages/dashboard/user/account'));
const UserCreatePage = lazy(() => import('src/pages/dashboard/user/new'));
const UserEditPage = lazy(() => import('src/pages/dashboard/user/edit'));
// Blog
const BlogPostsPage = lazy(() => import('src/pages/dashboard/post/list'));
const BlogPostPage = lazy(() => import('src/pages/dashboard/post/details'));
const BlogNewPostPage = lazy(() => import('src/pages/dashboard/post/new'));
const BlogEditPostPage = lazy(() => import('src/pages/dashboard/post/edit'));
// News
const NewsListPage = lazy(() => import('src/pages/dashboard/news/list'));
const NewsDetailsPage = lazy(() => import('src/pages/dashboard/news/details'));
const PositiveNewsPage = lazy(() => import('src/pages/dashboard/news/positive'));
const NegativeNewsPage = lazy(() => import('src/pages/dashboard/news/negative'));
// Job
const JobDetailsPage = lazy(() => import('src/pages/dashboard/job/details'));
const JobListPage = lazy(() => import('src/pages/dashboard/job/list'));
const JobCreatePage = lazy(() => import('src/pages/dashboard/job/new'));
const JobEditPage = lazy(() => import('src/pages/dashboard/job/edit'));
// Tour
const TourDetailsPage = lazy(() => import('src/pages/dashboard/tour/details'));
const TourListPage = lazy(() => import('src/pages/dashboard/tour/list'));
const TourCreatePage = lazy(() => import('src/pages/dashboard/tour/new'));
const TourEditPage = lazy(() => import('src/pages/dashboard/tour/edit'));
// File manager
const FileManagerPage = lazy(() => import('src/pages/dashboard/file-manager'));
// App
const ChatPage = lazy(() => import('src/pages/dashboard/chat'));
const MailPage = lazy(() => import('src/pages/dashboard/mail'));
const CalendarPage = lazy(() => import('src/pages/dashboard/calendar'));
const KanbanPage = lazy(() => import('src/pages/dashboard/kanban'));
const AssistantPage = lazy(() => import('src/pages/dashboard/assistant'));
const BuilderPage = lazy(() => import('src/pages/builder/index'));
// Test render page by role
const PermissionDeniedPage = lazy(() => import('src/pages/dashboard/permission'));
// Blank page
const ParamsPage = lazy(() => import('src/pages/dashboard/params'));
const BlankPage = lazy(() => import('src/pages/dashboard/blank'));
// Test routes
const TestNewsRoutePage = lazy(() => import('src/routes/test-news-route'));
// Profile
const ProfilePage = lazy(() => import('src/pages/dashboard/profile/profile'));
// Onboarding
const OnboardingPage = lazy(() => import('src/pages/dashboard/onboarding'));
// Health
const HealthPage = lazy(() => import('src/pages/dashboard/health'));
// Meal Planning
const MealPlanningPage = lazy(() => import('src/pages/dashboard/meal-planning'));
const MealPlanningHistoryPage = lazy(() => import('src/pages/dashboard/meal-planning/history'));
const MealPlanningViewPage = lazy(() => import('src/pages/dashboard/meal-planning/view'));
// Ridesharing
const RidesharingPage = lazy(() => import('src/pages/dashboard/ridesharing'));
// Friends
const FriendsPage = lazy(() => import('src/pages/dashboard/friends'));
// City
const CityDashboardPage = lazy(() => import('src/pages/dashboard/city'));
const CityRestaurantsPage = lazy(() => import('src/pages/dashboard/city/restaurants'));
const CityEventsPage = lazy(() => import('src/pages/dashboard/city/events'));
const CityOrdersPage = lazy(() => import('src/pages/dashboard/city/orders'));
const CityPublicTransitPage = lazy(() => import('src/pages/dashboard/city/public-transit'));
// Business Owner
const BusinessOwnerDashboardPage = lazy(() => import('src/pages/dashboard/business-owner'));
// Hijra
const HijraListPage = lazy(() => import('src/pages/dashboard/hijra/list'));
const HijraDetailsPage = lazy(() => import('src/pages/dashboard/hijra/details'));
const HijraNewPage = lazy(() => import('src/pages/dashboard/hijra/new'));
const HijraEditPage = lazy(() => import('src/pages/dashboard/hijra/edit'));

// ----------------------------------------------------------------------

const layoutContent = (
  <DashboardLayout>
    <Suspense fallback={<LoadingScreen/>}>
      <Outlet/>
    </Suspense>
  </DashboardLayout>
);

export const dashboardRoutes = [
  {
    path: 'dashboard',
    element: CONFIG.auth.skip 
      ? <>{layoutContent}</> 
      : <AuthGuard>{layoutContent}</AuthGuard>,
    children: [
      // Onboarding route with reverse guard
      { 
        path: 'onboarding', 
        element: (
          <ReverseOnboardingGuard>
            <OnboardingPage />
          </ReverseOnboardingGuard>
        ) 
      },

      // Direct access to meal planning routes (bypassing OnboardingGuard for testing)
      { path: 'meal-planning', element: <MealPlanningPage /> },
      { path: 'meal-planning/history', element: <MealPlanningHistoryPage /> },
      { path: 'meal-planning/view', element: <MealPlanningViewPage /> },
      
      // Direct access to ridesharing route (bypassing OnboardingGuard)
      { path: 'ridesharing', element: <RidesharingPage /> },
      
      // Direct access to friends route (bypassing OnboardingGuard)
      { path: 'friends', element: <FriendsPage /> },

      // All other routes protected by OnboardingGuard
      {
        element: (
          <OnboardingGuard>
            <Outlet />
          </OnboardingGuard>
        ),
        children: [
          { path: 'assistant', element: <AssistantPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'ecommerce', element: <OverviewEcommercePage /> },
          { path: 'analytics', element: <OverviewAnalyticsPage /> },
          { path: 'banking', element: <OverviewBankingPage /> },
          { path: 'booking', element: <OverviewBookingPage /> },
          { path: 'file', element: <OverviewFilePage /> },
          { path: 'course', element: <OverviewCoursePage /> },
          { path: 'liive-domains', element: <LiiveDomainsPage /> },
          { path: 'builder', element: <BuilderPage /> },
          
          // City Routes
          {
            path: 'city',
            children: [
              { element: <CityDashboardPage />, index: true },
              { path: 'restaurants', element: <CityRestaurantsPage /> },
              { path: 'events', element: <CityEventsPage /> },
              { path: 'orders', element: <CityOrdersPage /> },
              { path: 'public-transit', element: <CityPublicTransitPage /> },
            ],
          },
          
          // Business Owner Routes
          {
            path: 'business-owner',
            element: <BusinessOwnerDashboardPage />,
          },
          
          {
            path: 'user',
            children: [
              {element: <UserProfilePage/>, index: true},
              {path: 'profile', element: <UserProfilePage/>},
              {path: 'cards', element: <UserCardsPage/>},
              {path: 'list', element: <UserListPage/>},
              {path: 'new', element: <UserCreatePage/>},
              {path: ':id/edit', element: <UserEditPage/>},
              {path: 'account', element: <UserAccountPage/>},
            ],
          },
          {
            path: 'product',
            children: [
              {element: <ProductListPage/>, index: true},
              {path: 'list', element: <ProductListPage/>},
              {path: ':id', element: <ProductDetailsPage/>},
              {path: 'new', element: <ProductCreatePage/>},
              {path: ':id/edit', element: <ProductEditPage/>},
            ],
          },
          {
            path: 'post',
            children: [
              {element: <BlogPostsPage/>, index: true},
              {path: 'list', element: <BlogPostsPage/>},
              {path: ':title', element: <BlogPostPage/>},
              {path: 'new', element: <BlogNewPostPage/>},
              {path: ':title/edit', element: <BlogEditPostPage/>},
            ],
          },
          {
            path: 'news',
            children: [
              {element: <NewsListPage/>, index: true},
              {path: 'list', element: <NewsListPage/>},
              {path: 'positive', element: <PositiveNewsPage/>},
              {path: 'negative', element: <NegativeNewsPage/>},
              {path: ':title', element: <NewsDetailsPage/>},
            ],
          },
          {
            path: 'order',
            children: [
              {element: <OrderListPage/>, index: true},
              {path: 'list', element: <OrderListPage/>},
              {path: ':id', element: <OrderDetailsPage/>},
            ],
          },
          {
            path: 'invoice',
            children: [
              {element: <InvoiceListPage/>, index: true},
              {path: 'list', element: <InvoiceListPage/>},
              {path: ':id', element: <InvoiceDetailsPage/>},
              {path: ':id/edit', element: <InvoiceEditPage/>},
              {path: 'new', element: <InvoiceCreatePage/>},
            ],
          },
          {
            path: 'job',
            children: [
              {element: <JobListPage/>, index: true},
              {path: 'list', element: <JobListPage/>},
              {path: ':id', element: <JobDetailsPage/>},
              {path: 'new', element: <JobCreatePage/>},
              {path: ':id/edit', element: <JobEditPage/>},
            ],
          },
          {
            path: 'tour',
            children: [
              {element: <TourListPage/>, index: true},
              {path: 'list', element: <TourListPage/>},
              {path: ':id', element: <TourDetailsPage/>},
              {path: 'new', element: <TourCreatePage/>},
              {path: ':id/edit', element: <TourEditPage/>},
            ],
          },
          {
            path: 'hijra',
            children: [
              {element: <HijraListPage/>, index: true},
              {path: 'list', element: <HijraListPage/>},
              {path: 'new', element: <HijraNewPage/>},
              {path: ':id', element: <HijraDetailsPage/>},
              {path: ':id/edit', element: <HijraEditPage/>},
            ],
          },
          {path: 'file-manager', element: <FileManagerPage/>},
          {path: 'mail', element: <MailPage/>},
          {path: 'chat', element: <ChatPage/>},
          {path: 'calendar', element: <CalendarPage/>},
          {path: 'kanban', element: <KanbanPage/>},
          {path: 'permission', element: <PermissionDeniedPage/>},
          {path: 'params', element: <ParamsPage/>},
          {path: 'blank', element: <BlankPage/>},
          {path: 'health', element: <HealthPage/>},
          {path: 'test-news-route', element: <TestNewsRoutePage/>},
        ],
      },
    ],
  },
];
