type ProjectLike = {
  name: string;
  slug: string;
  category: string | null;
};

export function isGoodsProject(project: ProjectLike) {
  return project.slug === 'goods' || project.name.toLowerCase() === 'goods';
}

export function getProjectWorkspaceCopy(project: ProjectLike) {
  if (isGoodsProject(project)) {
    return {
      heading: 'Goods working lanes',
      description:
        'Use this as the compiled brief, then move into QBE Program, Goods Workspace, or the relevant board when you need to act.',
      decisionSource: 'Compiled From Goods Working Context',
      decisionDescription: 'Operating, capital, and procurement context compiled from the Goods wiki.',
      referenceDescription:
        'Keep the Goods operating lanes above as the main working surface. Open this when you need funding history, programs, contracts, ecosystem context, or discovery-side reference material.',
    };
  }

  return {
    heading: `${project.name} funding and relationship lanes`,
    description:
      'Use this as the compiled project brief, then move into grant tracking, foundation relationships, or reference signals when you need to act.',
    decisionSource: 'Compiled From Project Working Context',
    decisionDescription: 'Operating, capital, and relationship context compiled from Civic Scope project records.',
    referenceDescription:
      'Keep the project operating lanes above as the main working surface. Open this when you need funding history, programs, contracts, ecosystem context, or discovery-side reference material.',
  };
}
