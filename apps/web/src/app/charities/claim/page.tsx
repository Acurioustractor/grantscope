interface SearchParams {
  abn?: string;
}

export default async function ClaimPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const abn = params.abn;

  return (
    <div className="max-w-xl mx-auto py-16">
      <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow-sm">
        <div className="w-12 h-12 bg-bauhaus-yellow border-3 border-bauhaus-black flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-bauhaus-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="square" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <p className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-2">Coming Soon</p>
        <h1 className="text-2xl font-black text-bauhaus-black mb-4">Claim Your Profile</h1>

        <p className="text-bauhaus-muted font-medium leading-relaxed mb-4">
          Soon you&apos;ll be able to claim your charity&apos;s profile on GrantScope to:
        </p>

        <ul className="space-y-2 mb-6">
          {[
            'Update your organisation description and story',
            'Share your challenges navigating the grants system',
            'Get featured in our directory',
            'Connect with funders who align with your mission',
          ].map(item => (
            <li key={item} className="flex items-start gap-2 text-sm font-medium text-bauhaus-black">
              <span className="text-bauhaus-red font-black mt-0.5">&#9632;</span>
              {item}
            </li>
          ))}
        </ul>

        {abn && (
          <div className="bg-bauhaus-canvas border-2 border-bauhaus-black/20 px-4 py-3 mb-6">
            <div className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest">ABN</div>
            <div className="text-sm font-black text-bauhaus-black">{abn}</div>
          </div>
        )}

        <p className="text-sm text-bauhaus-muted font-medium mb-6">
          We&apos;re building this feature now. Want to be notified when it launches?
          Reach out at <a href="mailto:hello@grantscope.au" className="text-bauhaus-blue hover:text-bauhaus-red font-bold">hello@grantscope.au</a>
        </p>

        <a
          href={abn ? `/charities/${abn}` : '/charities'}
          className="inline-block px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
        >
          &larr; Back to {abn ? 'Profile' : 'Charities'}
        </a>
      </div>
    </div>
  );
}
