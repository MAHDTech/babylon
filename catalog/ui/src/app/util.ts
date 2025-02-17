// Use asciidoctor to translate descriptions
import AsciiDoctor from 'asciidoctor';
const asciidoctor = AsciiDoctor();

// Use dompurify to make asciidoctor output safe
import dompurify from 'dompurify';
// Force all links to target new window and not pass unsafe attributes
dompurify.addHook('afterSanitizeAttributes', function(node) {
  if (node.tagName == 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function checkAccessControl(accessConfig: any, userGroups: Array<string>): string {
  const groups: Array<string> = userGroups.concat('system:authenticated');
  if (!accessConfig) {
    return 'allow';
  }
  if((accessConfig.denyGroups || []).filter(group => groups.includes(group)).length > 0) {
    return 'deny';
  }
  if((accessConfig.allowGroups || []).filter(group => groups.includes(group)).length > 0) {
    return 'allow';
  }
  if((accessConfig.viewOnlyGroups || []).filter(group => groups.includes(group)).length > 0) {
    return 'viewOnly';
  }
  return 'deny';
}

export function checkCondition(condition: string, vars: object): boolean {
  return window.Function(
    Object.entries(vars).map(
      ([k, v]) => "const " + k + " = " + JSON.stringify(v) + ";"
    ).join("\n") +
    "return Boolean(" + condition + ");"
  )();
}

export function displayName(item: any): string {
  if (item.kind === 'ResourceClaim') {
    const catalogItemName = item.metadata.labels?.['babylon.gpte.redhat.com/catalogItemName'];
    const catalogItemDisplayName = item.metadata.annotations?.['babylon.gpte.redhat.com/catalogItemDisplayName'];
    if (catalogItemName && catalogItemDisplayName && item.metadata.name === catalogItemName) {
      return catalogItemDisplayName;
    } else if (catalogItemName && catalogItemDisplayName && item.metadata.name.startsWith(catalogItemName)) {
      return `${catalogItemDisplayName} - ${item.metadata.name.substring(1 + catalogItemName.length)}`;
    } else {
      return item.metadata.name;
    }
  } else {
    return (
      item.metadata?.annotations?.['babylon.gpte.redhat.com/displayName'] ||
      item.metadata?.annotations?.['babylon.gpte.redhat.com/display-name'] ||
      item.metadata?.annotations?.['openshift.io/display-name'] ||
      item.displayName ||
      item.metadata.name ||
      item.name
    );
  }
}

export function randomString(length: number): string {
  return Math.floor(Math.random() * 36**length).toString(36).padStart(length,'0');
}

export function recursiveAssign(target: object, source: object): any {
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === 'object' && k in target && target[k] !== null && typeof target[k] === 'object') {
      recursiveAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

export function renderContent(content: string, options: any={}): string {
  const sanitize_opt = {
    ADD_TAGS: [] as any,
    ADD_ATTR: [] as any,
  };
  if (options.allowIFrame) {
    sanitize_opt.ADD_TAGS.push('iframe');
    sanitize_opt.ADD_ATTR.push('allowfullscreen', 'frameborder');
  }
  if (options.format === 'html') {
    return dompurify.sanitize(content, sanitize_opt);
  } else {
    return dompurify.sanitize(asciidoctor.convert(content), sanitize_opt);
  }
}

export function checkResourceClaimCanStart(resourceClaim) {
  return !!(
    (resourceClaim?.status?.resources || []).find((r, idx) => {
      const state = r.state;
      const template = resourceClaim.spec.resources[idx]?.template;
      if (!state || !template) {
        return false;
      }
      const currentState = state?.spec?.vars?.current_state;
      if (currentState && (currentState.endsWith('-failed') || currentState === 'provision-canceled')) {
        return false;
      }
      const startTimestamp = template?.spec?.vars?.action_schedule?.start || state?.spec?.vars?.action_schedule?.start;
      const stopTimestamp = template?.spec?.vars?.action_schedule?.stop || state?.spec?.vars?.action_schedule?.stop;
      if (startTimestamp && stopTimestamp) {
        const startTime = Date.parse(startTimestamp);
        const stopTime = Date.parse(stopTimestamp);
        return startTime > Date.now() || stopTime < Date.now();
      } else {
        return false;
      }
    })
  );
}

export function checkResourceClaimCanStop(resourceClaim) {
  return !!(
    (resourceClaim?.status?.resources || []).find((r, idx) => {
      const state = r.state;
      const template = resourceClaim.spec.resources[idx]?.template;
      if (!state || !template) {
        return false;
      }
      const currentState = state?.spec?.vars?.current_state;
      if (currentState && (currentState.endsWith('-failed') || currentState === 'provision-canceled')) {
        return false;
      }
      const startTimestamp = template?.spec?.vars?.action_schedule?.start || state?.spec?.vars?.action_schedule?.start;
      const stopTimestamp = template?.spec?.vars?.action_schedule?.stop || state?.spec?.vars?.action_schedule?.stop;
      if (startTimestamp && stopTimestamp) {
        const startTime = Date.parse(startTimestamp);
        const stopTime = Date.parse(stopTimestamp);
        return startTime < Date.now() && stopTime > Date.now();
      } else {
        return false;
      }
    })
  );
}
