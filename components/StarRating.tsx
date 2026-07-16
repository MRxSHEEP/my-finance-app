export default function StarRating({ rating }: { rating: number | null }) {
  const rounded = rating !== null ? Math.round(rating) : 0;

  return (
    <div
      className="flex text-yellow-500"
      aria-label={rating !== null ? `${rating.toFixed(1)} out of 5 stars` : "No rating available"}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}>{n <= rounded ? "★" : "☆"}</span>
      ))}
    </div>
  );
}
