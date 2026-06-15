import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';

import { NewsDetailsView } from 'src/sections/news/view';

// ----------------------------------------------------------------------

export default function NewsDetailsPage() {
  const params = useParams();
  
  // This would be replaced with actual news data fetching
  const mockNews = {
    id: '1',
    title: 'Example News Article',
    description: 'This is an example news article to demonstrate the news details view.',
    content: '# Example News Content\n\nThis is the main content of the news article. It would normally contain information about current events.',
    coverUrl: '/assets/images/covers/cover_1.jpg',
    createdAt: new Date().toISOString(),
    publish: 'published',
    tags: ['news', 'example'],
    metaTitle: 'Example News Article | Liive News',
    metaDescription: 'Read about current events with context and expert analysis',
    metaKeywords: ['news', 'current events', 'analysis'],
    author: {
      name: 'John Doe',
      avatarUrl: '/assets/images/avatars/avatar_1.jpg',
    },
    totalFavorites: 420,
    favoritePerson: [
      { name: 'User 1', avatarUrl: '/assets/images/avatars/avatar_2.jpg' },
      { name: 'User 2', avatarUrl: '/assets/images/avatars/avatar_3.jpg' },
    ],
    isPositive: true,
    context: 'This section provides additional context about the news story to help readers understand the bigger picture.',
    history: 'This section offers historical background about the topic to provide perspective on current events.',
    solutions: 'This section highlights potential solutions or positive developments related to challenging issues.',
    totalViews: 5023,
    totalShares: 1500,
    totalComments: 230,
    comments: [],
    sources: [
      {
        name: 'Dr. Jane Smith',
        title: 'Professor of International Relations',
        organization: 'University of Example',
        credentials: 'PhD in Political Science, author of several books on global politics',
      },
      {
        name: 'Robert Johnson',
        title: 'Senior Policy Advisor',
        organization: 'Global Solutions Institute',
        credentials: '20 years of experience in policy development and implementation',
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>{`News: ${mockNews.title}`}</title>
      </Helmet>

      <NewsDetailsView news={mockNews} />
    </>
  );
} 