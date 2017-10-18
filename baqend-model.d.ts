import {binding, GeoPoint} from "baqend";

declare module "baqend" {

  interface baqend {
    Test2: binding.EntityFactory<model.Test2>;
    TestOverview: binding.EntityFactory<model.TestOverview>;
    TestResult: binding.EntityFactory<model.TestResult>;
    Completeness: binding.ManagedFactory<model.Completeness>;
    Run: binding.ManagedFactory<model.Run>;
    Hits: binding.ManagedFactory<model.Hits>;
  }

  namespace model {
    interface Device extends binding.Entity {
      deviceOs: string;
    }

    interface User extends binding.Entity {
    }

    interface Test2 extends binding.Entity {
    }

    interface TestOverview extends binding.Entity {
      psiDomains: number;
      psiRequests: number;
      psiResponseSize: string;
      caching: boolean;
      mobile: boolean;
      competitorTestResult: TestResult;
      speedKitTestResult: TestResult;
      whitelist: string;
      speedKit: any;
    }

    interface TestResult extends binding.Entity {
      testId: string;
      firstView: Run;
      repeatView: Run;
      location: string;
      url: string;
      summaryUrl: string;
      videoIdFirstView: string;
      videoIdRepeatedView: string;
      testDataMissing: boolean;
      videoFileFirstView: undefined;
      videoFileRepeatView: undefined;
    }

    interface Role extends binding.Entity {
      name: string;
      users: Set<User>;
    }

    interface Completeness extends binding.Managed {
      p85: number;
      p90: number;
      p95: number;
      p99: number;
      p100: number;
    }

    interface Run extends binding.Managed {
      loadTime: number;
      ttfb: number;
      domLoaded: number;
      load: number;
      fullyLoaded: number;
      firstPaint: number;
      startRender: number;
      lastVisualChange: number;
      speedIndex: number;
      requests: number;
      bytes: number;
      domElements: number;
      basePageCDN: string;
      visualCompleteness: Completeness;
      hits: Hits;
    }

    interface Hits extends binding.Managed {
      hit: number;
      miss: number;
      other: number;
    }

  }
}
