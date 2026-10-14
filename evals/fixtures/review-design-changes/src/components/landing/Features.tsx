const FEATURES = [
  { icon: '🚀', title: 'Fast', description: 'Results in milliseconds.' },
  { icon: '⚡', title: 'Powerful', description: 'Filters for every need.' },
  { icon: '🔒', title: 'Secure', description: 'Your searches stay private.' },
];

export function Features() {
  return (
    <section className="px-6 py-16 text-center">
      <div className="grid grid-cols-3 gap-8">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-3xl">
              {feature.icon}
            </div>
            <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
            <p className="mt-2 text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
