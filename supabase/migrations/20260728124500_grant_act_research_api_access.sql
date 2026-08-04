GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.act_opportunity_observatory
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.act_research_initiatives, public.act_research_experiments
  TO service_role;
