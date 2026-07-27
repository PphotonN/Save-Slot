<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>Save Slot</title>
</svelte:head>

{@render children()}
