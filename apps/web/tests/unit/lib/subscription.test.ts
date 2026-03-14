import { describe, it, expect } from 'vitest';
import {
  resolveSubscriptionTier,
  hasModule,
  minimumTier,
  tierRank,
  getModules,
  type Tier,
  type Module,
} from '@/lib/subscription';

describe('subscription', () => {
  describe('resolveSubscriptionTier', () => {
    it('returns community for null', () => {
      expect(resolveSubscriptionTier(null)).toBe('community');
    });

    it('returns community for undefined', () => {
      expect(resolveSubscriptionTier(undefined)).toBe('community');
    });

    it('returns community for empty string', () => {
      expect(resolveSubscriptionTier('')).toBe('community');
    });

    it('returns professional for "professional"', () => {
      expect(resolveSubscriptionTier('professional')).toBe('professional');
    });

    it('returns enterprise for "ENTERPRISE" (case insensitive)', () => {
      expect(resolveSubscriptionTier('ENTERPRISE')).toBe('enterprise');
    });

    it('returns organisation for "organisation"', () => {
      expect(resolveSubscriptionTier('organisation')).toBe('organisation');
    });

    it('returns funder for "funder"', () => {
      expect(resolveSubscriptionTier('funder')).toBe('funder');
    });

    it('returns community for invalid tier name', () => {
      expect(resolveSubscriptionTier('invalid')).toBe('community');
    });

    it('handles whitespace trimming', () => {
      expect(resolveSubscriptionTier('  professional  ')).toBe('professional');
    });
  });

  describe('hasModule', () => {
    it('community has grants', () => {
      expect(hasModule('community', 'grants')).toBe(true);
    });

    it('community has research', () => {
      expect(hasModule('community', 'research')).toBe(true);
    });

    it('community does NOT have procurement', () => {
      expect(hasModule('community', 'procurement')).toBe(false);
    });

    it('community does NOT have tracker', () => {
      expect(hasModule('community', 'tracker')).toBe(false);
    });

    it('professional has tracker', () => {
      expect(hasModule('professional', 'tracker')).toBe(true);
    });

    it('professional does NOT have procurement', () => {
      expect(hasModule('professional', 'procurement')).toBe(false);
    });

    it('organisation has procurement', () => {
      expect(hasModule('organisation', 'procurement')).toBe(true);
    });

    it('organisation has allocation', () => {
      expect(hasModule('organisation', 'allocation')).toBe(true);
    });

    it('organisation does NOT have api', () => {
      expect(hasModule('organisation', 'api')).toBe(false);
    });

    it('funder has api', () => {
      expect(hasModule('funder', 'api')).toBe(true);
    });

    it('funder does NOT have supply-chain', () => {
      expect(hasModule('funder', 'supply-chain')).toBe(false);
    });

    it('funder does NOT have governed-proof', () => {
      expect(hasModule('funder', 'governed-proof')).toBe(false);
    });

    it('enterprise has everything', () => {
      const allModules: Module[] = [
        'grants',
        'tracker',
        'procurement',
        'supply-chain',
        'allocation',
        'research',
        'governed-proof',
        'api',
      ];
      allModules.forEach((module) => {
        expect(hasModule('enterprise', module)).toBe(true);
      });
    });
  });

  describe('minimumTier', () => {
    it('grants requires community', () => {
      expect(minimumTier('grants')).toBe('community');
    });

    it('research requires community', () => {
      expect(minimumTier('research')).toBe('community');
    });

    it('tracker requires professional', () => {
      expect(minimumTier('tracker')).toBe('professional');
    });

    it('procurement requires organisation', () => {
      expect(minimumTier('procurement')).toBe('organisation');
    });

    it('allocation requires organisation', () => {
      expect(minimumTier('allocation')).toBe('organisation');
    });

    it('api requires funder', () => {
      expect(minimumTier('api')).toBe('funder');
    });

    it('supply-chain requires enterprise', () => {
      expect(minimumTier('supply-chain')).toBe('enterprise');
    });

    it('governed-proof requires enterprise', () => {
      expect(minimumTier('governed-proof')).toBe('enterprise');
    });
  });

  describe('tierRank', () => {
    it('community < professional', () => {
      expect(tierRank('community')).toBeLessThan(tierRank('professional'));
    });

    it('professional < organisation', () => {
      expect(tierRank('professional')).toBeLessThan(tierRank('organisation'));
    });

    it('organisation < funder', () => {
      expect(tierRank('organisation')).toBeLessThan(tierRank('funder'));
    });

    it('funder < enterprise', () => {
      expect(tierRank('funder')).toBeLessThan(tierRank('enterprise'));
    });

    it('community rank is 0', () => {
      expect(tierRank('community')).toBe(0);
    });

    it('enterprise rank is 4', () => {
      expect(tierRank('enterprise')).toBe(4);
    });
  });

  describe('getModules', () => {
    it('community gets 2 modules', () => {
      const modules = getModules('community');
      expect(modules).toHaveLength(2);
      expect(modules).toEqual(['grants', 'research']);
    });

    it('professional gets 3 modules', () => {
      const modules = getModules('professional');
      expect(modules).toHaveLength(3);
      expect(modules).toContain('grants');
      expect(modules).toContain('tracker');
      expect(modules).toContain('research');
    });

    it('organisation gets 5 modules', () => {
      const modules = getModules('organisation');
      expect(modules).toHaveLength(5);
      expect(modules).toContain('procurement');
      expect(modules).toContain('allocation');
    });

    it('funder gets 6 modules', () => {
      const modules = getModules('funder');
      expect(modules).toHaveLength(6);
      expect(modules).toContain('api');
    });

    it('enterprise gets all 8 modules', () => {
      const modules = getModules('enterprise');
      expect(modules).toHaveLength(8);
      expect(modules).toContain('supply-chain');
      expect(modules).toContain('governed-proof');
    });
  });
});
