import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuthContext } from 'src/auth/hooks';

// Mock types - these would be imported from @livve-1/database-types in a real implementation
interface Restaurant {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  status: string;
  photoUrl: string;
}

interface Event {
  id: string;
  name: string;
  category: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: string;
  photoUrl: string;
}

interface Order {
  id: string;
  restaurantId: string;
  customerName: string;
  amount: number;
  status: string;
  createdAt: Date;
}

interface TransitRoute {
  id: string;
  name: string;
  type: string;
  stops: number;
  status: string;
}

interface CityStatistics {
  totalRestaurants: number;
  totalEvents: number;
  totalOrders: number;
  totalPublicTransit: number;
}

export function useCityData() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [statistics, setStatistics] = useState<CityStatistics>({
    totalRestaurants: 0,
    totalEvents: 0,
    totalOrders: 0,
    totalPublicTransit: 0
  });
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transitRoutes, setTransitRoutes] = useState<TransitRoute[]>([]);

  const functions = getFunctions();

  // For development purposes, we're using mock data
  // In a real implementation, these would call Firebase functions
  const fetchMockData = useCallback(() => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setStatistics({
        totalRestaurants: 25,
        totalEvents: 18,
        totalOrders: 153,
        totalPublicTransit: 8
      });
      
      setRestaurants([
        {
          id: '1',
          name: 'Fwencheese',
          category: 'French',
          location: 'Avignon',
          rating: 4.5,
          status: 'active',
          photoUrl: '/assets/images/restaurants/1.jpg',
        },
        {
          id: '2',
          name: 'Pasta Paradise',
          category: 'Italian',
          location: 'Lyon',
          rating: 4.2,
          status: 'active',
          photoUrl: '/assets/images/restaurants/2.jpg',
        },
        {
          id: '3', 
          name: 'Sushi Sensation',
          category: 'Japanese',
          location: 'Paris',
          rating: 4.7,
          status: 'active',
          photoUrl: '/assets/images/restaurants/3.jpg',
        },
        {
          id: '4',
          name: 'Taco Temple',
          category: 'Mexican',
          location: 'Nice',
          rating: 4.0,
          status: 'inactive',
          photoUrl: '/assets/images/restaurants/4.jpg',
        },
        {
          id: '5',
          name: 'Burger Bistro',
          category: 'American',
          location: 'Marseille',
          rating: 3.9,
          status: 'active',
          photoUrl: '/assets/images/restaurants/5.jpg',
        },
      ]);
      
      setEvents([
        {
          id: '1',
          name: 'Food Festival',
          category: 'Food',
          location: 'Avignon City Center',
          startDate: new Date(2023, 5, 15),
          endDate: new Date(2023, 5, 17),
          status: 'upcoming',
          photoUrl: '/assets/images/events/1.jpg',
        },
        {
          id: '2',
          name: 'Wine Tasting',
          category: 'Drinks',
          location: 'Lyon Convention Center',
          startDate: new Date(2023, 6, 10),
          endDate: new Date(2023, 6, 10),
          status: 'upcoming',
          photoUrl: '/assets/images/events/2.jpg',
        },
      ]);
      
      setOrders([
        {
          id: '1',
          restaurantId: '1',
          customerName: 'John Doe',
          amount: 42.50,
          status: 'completed',
          createdAt: new Date(2023, 4, 25),
        },
        {
          id: '2',
          restaurantId: '3',
          customerName: 'Jane Smith',
          amount: 35.75,
          status: 'processing',
          createdAt: new Date(2023, 4, 27),
        },
      ]);
      
      setTransitRoutes([
        {
          id: '1',
          name: 'Line 1',
          type: 'bus',
          stops: 12,
          status: 'operational',
        },
        {
          id: '2',
          name: 'Line 2',
          type: 'tram',
          stops: 8,
          status: 'operational',
        },
      ]);
      
      setLoading(false);
    }, 500);
  }, []);

  // Get city statistics
  const getCityStatistics = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to view city statistics');
      return null;
    }

    // In a real implementation, this would call a Firebase function
    // const getCityStatsFn = httpsCallable(functions, 'getCityStatistics');
    // const result = await getCityStatsFn();
    // setStatistics(result.data);
    
    // For development, we're using mock data
    fetchMockData();
    return statistics;
  }, [user, fetchMockData, statistics]);

  // Get restaurants
  const getRestaurants = useCallback(async (filters = {}) => {
    if (!user) {
      setError('You must be logged in to view restaurants');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would call a Firebase function
      // const getRestaurantsFn = httpsCallable(functions, 'getRestaurants');
      // const result = await getRestaurantsFn({ filters });
      // const restaurantsList = result.data.restaurants;
      // setRestaurants(restaurantsList);
      
      // For development, we're using mock data
      fetchMockData();
      return restaurants;
    } catch (err) {
      console.error('Error getting restaurants:', err);
      setError('Failed to get restaurants. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, fetchMockData, restaurants]);

  // Get events
  const getEvents = useCallback(async (filters = {}) => {
    if (!user) {
      setError('You must be logged in to view events');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would call a Firebase function
      // const getEventsFn = httpsCallable(functions, 'getEvents');
      // const result = await getEventsFn({ filters });
      // const eventsList = result.data.events;
      // setEvents(eventsList);
      
      // For development, we're using mock data
      fetchMockData();
      return events;
    } catch (err) {
      console.error('Error getting events:', err);
      setError('Failed to get events. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, fetchMockData, events]);

  // Get orders
  const getOrders = useCallback(async (filters = {}) => {
    if (!user) {
      setError('You must be logged in to view orders');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would call a Firebase function
      // const getOrdersFn = httpsCallable(functions, 'getOrders');
      // const result = await getOrdersFn({ filters });
      // const ordersList = result.data.orders;
      // setOrders(ordersList);
      
      // For development, we're using mock data
      fetchMockData();
      return orders;
    } catch (err) {
      console.error('Error getting orders:', err);
      setError('Failed to get orders. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, fetchMockData, orders]);

  // Get transit routes
  const getTransitRoutes = useCallback(async (filters = {}) => {
    if (!user) {
      setError('You must be logged in to view transit routes');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would call a Firebase function
      // const getTransitRoutesFn = httpsCallable(functions, 'getTransitRoutes');
      // const result = await getTransitRoutesFn({ filters });
      // const routesList = result.data.routes;
      // setTransitRoutes(routesList);
      
      // For development, we're using mock data
      fetchMockData();
      return transitRoutes;
    } catch (err) {
      console.error('Error getting transit routes:', err);
      setError('Failed to get transit routes. Please try again.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user, fetchMockData, transitRoutes]);

  return {
    // Data
    statistics,
    restaurants,
    events,
    orders,
    transitRoutes,
    
    // Status
    loading,
    error,
    
    // Methods
    getCityStatistics,
    getRestaurants,
    getEvents,
    getOrders,
    getTransitRoutes
  };
} 