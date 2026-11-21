"use client";

import { PortalSubnav } from "@/components/PortalSubnav";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { Images } from "lucide-react";
import { useEffect, useState } from "react";

type Album = {
  id: string;
  title: string;
  category?: string;
  eventDate?: string;
  coverUrl?: string;
  photoUrls?: string[];
};

export default function PortalGalleryPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void adminApiRequest<{ albums: Album[] }>("/api/portal/gallery")
      .then((data) => {
        if (active) setAlbums(data.albums ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof AdminApiError ? err.message : "Unable to load gallery");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PortalSubnav />
      <main className="px-4 py-6 md:px-7">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Photo Gallery</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">School events and classroom moments shared by the school.</p>

        {error && <div className="card mt-4 border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : albums.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Images size={28} /> No albums shared yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <article key={album.id} className="card overflow-hidden">
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={album.coverUrl} alt={album.title} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-muted text-muted-foreground">
                    <Images size={32} />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-bold text-foreground">{album.title}</h2>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {album.category || "School"} · {album.eventDate || ""}
                  </p>
                  {album.photoUrls && album.photoUrls.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {album.photoUrls.slice(0, 6).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="h-16 w-full rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
