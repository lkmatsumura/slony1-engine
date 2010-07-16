#!@@PERL@@
# 
# Author: Christopher Browne
# Copyright 2004-2009 Afilias Canada

use Getopt::Long;

# Defaults
$CONFIG_FILE = '@@SYSCONFDIR@@/slon_tools.conf';
$SHOW_USAGE  = 0;

# Read command-line options
GetOptions("config=s" => \$CONFIG_FILE,
	   "help"     => \$SHOW_USAGE);

my $USAGE =
"Usage: merge_sets [--config file] node# set# set#

    Merges the contents of the second set into the first one.

";

if ($SHOW_USAGE) {
  print $USAGE;
  exit 0;
}

require '@@PGLIBDIR@@/slon-tools.pm';
require $CONFIG_FILE;

my ($node, $set1, $set2) = @ARGV;
if ($node =~ /^(?:node)?(\d+)$/) {
  # Set name is in proper form
  $node = $1;
} else {
  print "Valid node names are node1, node2, ...\n\n";
  die $USAGE;
}

if ($set1 =~ /^(?:set)?(\d+)$/) {
  $set1 = $1;
} else {
  print "Valid set names are set1, set2, ...\n\n";
  die $USAGE;
}

if ($set2 =~ /^(?:set)?(\d+)$/) {
  $set2 = $1;
} else {
  print "Valid set names are set1, set2, ...\n\n";
  die $USAGE;
}

my ($dbname, $dbhost) = ($DBNAME[$MASTERNODE], $HOST[$MASTERNODE]);

my $slonik = '';

$slonik .= genheader();
$slonik .= "  try {\n";
$slonik .= "    merge set (id = $set1, add id = $set2, origin = $node);\n";
$slonik .= "  } on error {\n";
$slonik .= "    echo 'Failure to merge sets $set1 and $set2 with origin $node';\n";
$slonik .= "    exit 1;\n";
$slonik .= "  }\n";
$slonik .= "  echo 'Replication set $set2 merged in with $set1 on origin $node';\n";

run_slonik_script($slonik, 'MERGE SET');
