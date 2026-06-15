import { useState, useEffect } from 'react';

// Mock data for city entities
export function useFetchData() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real app, this would be a fetch call to your API
        // For now, we'll simulate a delay and return mock data
        await new Promise(resolve => setTimeout(resolve, 500));

        setData({
          totalRestaurants: 25,
          totalEvents: 18,
          totalOrders: 153,
          totalPublicTransit: 8,
          restaurants: [
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
          ],
          events: [
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
          ],
          orders: [
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
          ],
        });
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
} 