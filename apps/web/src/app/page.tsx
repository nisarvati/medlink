import { Suspense } from "react";
import { SearchPage } from "../components/search/SearchPage";
import { Skeleton } from "../components/ui/primitives";

export default function Page() {
  // useSearchParams (the URL is the search's state) needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-64 max-w-3xl" />}>
      <SearchPage />
    </Suspense>
  );
}
