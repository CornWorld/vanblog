import { useEffect, useState } from 'react';
import { getArticleViewer } from '../../api/getAllData';
import { GetStaticProps } from 'next';

interface PostViewerProps {
  shouldAddViewer: boolean;
  initialViewer?: number;
}

export default function PostViewer({ shouldAddViewer, initialViewer = 0 }: PostViewerProps) {
  const [viewer, setViewer] = useState(initialViewer);

  // Only run once on initial render
  useEffect(() => {
    // Don't increment if noViewer is set to true
    if (localStorage?.getItem('noViewer') === 'true') {
      return;
    }

    // If we should add a viewer, simply increment the local count
    if (shouldAddViewer) {
      setViewer(initialViewer + 1);
    }
    // No API calls here at all
  }, [shouldAddViewer, initialViewer]);

  return <span>{viewer}</span>;
}

export const getStaticProps = (async (context) => {
  // Extract the id from context params
  const id = context.params?.id;

  // If no id is provided, return initialViewer as 0
  if (!id) {
    const result = {
      props: { initialViewer: 0 },
    };
    return result;
  }

  // Ensure id is a string or number
  const postId = Array.isArray(id) ? id[0] : id;

  // Fetch initial viewer count at build time
  const res = await getArticleViewer(postId);

  const result = {
    props: {
      initialViewer: res?.viewer || 0,
    },
    // Revalidate every hour to keep viewer counts somewhat up-to-date
    revalidate: 3600,
  };
  return result;
}) satisfies GetStaticProps;
