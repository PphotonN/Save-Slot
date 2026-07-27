<script lang="ts">
  import '../app.css';
  import '../flow.css';
  import CollectionImportGuard from '$lib/components/CollectionImportGuard.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <title>Save Slot</title>
</svelte:head>

{@render children()}
<CollectionImportGuard />
