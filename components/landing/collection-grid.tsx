export function CollectionGrid() {
  return (
    <div className="grid grid-cols-3 gap-3 w-64 md:w-72">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg border border-border
                     transition-colors duration-200 hover:border-primary"
        />
      ))}
    </div>
  );
}
