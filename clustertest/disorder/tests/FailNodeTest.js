/**
 * This test will exercise the behaviour of node failing.
 *
 * Recall we have a cluster of the form
 * 
 * 
 * 1====>2
 * \\
 *   3====5
 *    \\\
 *      4
 *
 */

coordinator.includeFile("disorder/tests/BasicTest.js");


function FailNodeTest(coordinator,results) {
	BasicTest.call(this,coordinator,results);
	this.syncWaitTime = 60;
	this.testDescription='This test tries to simulate node failures'
		+' the node failures and how slony can recover without using'
		+' the FAILOVER command. It does this by reshaping the cluster';
}

FailNodeTest.prototype = new BasicTest();
FailNodeTest.prototype.constructor=FailNodeTest;

FailNodeTest.prototype.runTest = function() {


	this.testResults.newGroup("Fail Node Test");
	//this.prepareDb(['db1','db2']);

	
//First setup slony

	this.setupReplication();
	this.addCompletePaths();
	this.addTables();
	
	//Start the slons.
	//These must be started before slonik runs or the subscribe won't happen
	//thus slonik won't finish.
	this.slonArray=[];
	for(var idx=1; idx <= this.getNodeCount(); idx++) {
		this.slonArray[idx-1] = this.coordinator.createSlonLauncher('db' + idx);
		this.slonArray[idx-1].run();
	}
	
	this.coordinator.log('performing initial subscriptions');
	this.subscribeSet(1,1,1,[2,3]);
	
	this.subscribeSet(1,1,3,[4,5]);
	
	this.coordinator.log('subscriptions complete');
	
	var load = this.generateLoad();
	load.run();
	
	this.slonikSync(1, 1);
	this.coordinator.log('failing node 4');
	this.failNode(4,false);
	//Issue a sync to all, then check all other nodes to confirm that
	//sl_subscribe has no reference.
	this.slonikSync(1,1);
	for(var idx=1; idx <= this.getNodeCount(); idx++) {
		if(idx==4) {
			continue;
		}
		this.checkNodeNotExists(idx,4);
		//Now rebuild the node.
		
	}
	
	//this.slonArray[3] = this.coordinator.createSlonLauncher('db4');
	//this.slonArray[3].run();
	//Readd the node.
	this.coordinator.log('adding node back');
	this.reAddNode(4,1,3);
	
	
	/**
	 * DROP 3 node.
	 * We expect it to fail since node 3 is still a provider
	 * for nodes 4,5.
	 */
	this.coordinator.log('failing node 3');
	this.failNode(3,true);
	
	/**
	 * Readd all paths, some might have been deleted and not readded
	 * when we deleted nodes above.
	 * 
	 * We also have to restart the slons because of bug # 120
	 */
	this.addCompletePaths();
	/**
	 * Sleep a bit.
	 * Do we need to do this for the paths to propogate????
	 */
	java.lang.Thread.sleep(60*1000);
	this.coordinator.log('restarting slons');
	for(var idx=1; idx <= this.getNodeCount(); idx++) {
		this.slonArray[idx-1].stop();
		this.coordinator.join(this.slonArray[idx-1]);
		this.slonArray[idx-1] = this.coordinator.createSlonLauncher('db' + idx);
		this.slonArray[idx-1].run();
	}
	java.lang.Thread.sleep(60*1000);
	/**
	 * Replace the generateSlonikWait function with a version that 
	 * does individual wait for event(..) statements instead of 
	 * a confirmed=all since we do not want to be waiting on node 3
	 * since we just destroyed it.
	 */
	var originalGenerateWait = this.generateSlonikWait;
	this.generateSlonikWait=function(event_node) {
		var script='';
		for(var idx=1; idx <= this.getNodeCount(); idx ++) {
			if(idx==3||idx==event_node) {
				continue;
			}
			script += "echo 'waiting on confirm from " + idx + "';\n";
			script+='wait for event(origin=' + event_node + ',confirmed='+idx +',wait on=' + event_node+');\n';
		}
		return script;
	}
	/**
	 * SUBSCRIBE nodes 4,5 via node 1 directly. 
	 */
	
	this.subscribeSet(1,1,1,[4,5]);
	
	
	
	/**
	 * Now we should be able to drop node 3.
	 */	
	this.failNode(3,false);
	this.generateSlonikWait=originalGenerateWait;
		
	
	load.stop();
	this.slonikSync(1,1);
	// Run some comparisions
	this.compareDb('db1','db2');
	this.compareDb('db1','db4');
	this.compareDb('db1','db5');
	
	//Start the load again.
	load = this.generateLoad();
	load.run();
	/**
	 * Now make nodes 4,5 subscribe via node 2.
	 * paths should exist since we added complete paths above.  
	 */	
	
	
	/**
	 * Generate 10 seconds of load.
	 */
	java.lang.Thread.sleep(10*1000);
	load.stop();
	this.coordinator.join(load);
	this.addCompletePaths();
	this.slonikSync(1,1);
	this.slonikSync(1,2);	
	this.slonikSync(1,4);
	this.slonikSync(1,5);

	this.subscribeSet(1,1,2,[4,5]);
	
	this.slonikSync(1,1);
	this.compareDb('db1','db2');
	this.compareDb('db1','db4');
	this.compareDb('db1','db5');
	
	//More load.
	load = this.generateLoad();
	load.run();
	//Now kill the node 2 slon.
	this.slonArray[1].stop();
	this.coordinator.join(this.slonArray[1]);
	//Now DROP the database. This lets us simulate a hard failure.
	this.dropDb(['db2']);
	/**
	 * Replace the generateSlonikWait function with a version that 
	 * does individual wait for event(..) statements instead of 
	 * a confirmed=all since we do not want to be waiting on node 3
	 * since we just destroyed it.
	 */
	var originalGenerateWait = this.generateSlonikWait;
	this.generateSlonikWait=function(event_node) {
		var script='';
		for(var idx=1; idx <= this.getNodeCount(); idx ++) {
			if(idx==2|| idx==3|| idx==event_node) {
				continue;
			}
			script += "echo 'waiting on confirm from " + idx + "';\n";
			script+='wait for event(origin=' + event_node + ',confirmed='+idx +',wait on=' + event_node+');\n';
		}
		return script;
	}
	
	//Now reshape the cluster.
	this.subscribeSet(1,1,1,[4,5]);
	
	
	//Drop node 2.
	this.failNode(2, false);
	
	
	java.lang.Thread.sleep(10*1000);
	load.stop();
	this.coordinator.join(load);
	this.slonikSync(1,1);
	
	this.coordinator.log('Stopping slons');
	for(var idx=0; idx < this.slonArray.length; idx++) {
		
		this.slonArray[idx].stop();
		this.coordinator.join(this.slonArray[idx]);
	}
	
	
	
	
}

/**
 * Fails the indicated node.
 * 
 * This is accomplished by 
 * 
 * 1. Killing the slon for that node
 * 2. executing DROP NODE.
 */
FailNodeTest.prototype.failNode=function(nodeId, expectFailure) {
	this.slonArray[nodeId-1].stop();
	this.coordinator.join(this.slonArray[nodeId-1]);
	var slonikPreamble = this.getSlonikPreamble();
	var slonikScript = 'DROP NODE(id=' + nodeId + ',event node=1);\n';
	for(var idx=2; idx <= this.getNodeCount(); idx++) {
		if(idx == nodeId) {
			continue;
		}
		slonikScript +=  'wait for event(origin=1,confirmed=' + idx + ', wait on=1 );\n';
	}
		
	var slonik=this.coordinator.createSlonik('drop node',slonikPreamble,slonikScript);
	slonik.run();
	this.coordinator.join(slonik);
	if(expectFailure) {
		this.testResults.assertCheck('drop node failed as expected',slonik.getReturnCode(),255);
	}
	else { 
		this.testResults.assertCheck('drop node okay',slonik.getReturnCode(),0);
	}
	
}

FailNodeTest.prototype.checkNodeNotExists=function(check_node,nodeid) {
	
	var con = this.coordinator.createJdbcConnection('db' + check_node);
	var stat = con.createStatement();
	var rs = stat.executeQuery('SELECT COUNT(*) FROM _' + 
			this.getClusterName() + '.sl_node WHERE ' + 
			'no_id='  + nodeid);
	if(rs.next()) {
		this.testResults.assertCheck('no reference to node ' + nodeid + ' on ' + check_node ,rs.getInt(1),0);
	}
	else {
		this.testResults.assertCheck('error querying sl_node');
	}
	rs.close();
	stat.close();
	con.close();
}

FailNodeTest.prototype.reAddNode = function(node_id,origin,provider) {
	this.coordinator.log('reAddNode(' + node_id + ',' + provider + ')');
	var slonikPreamble = this.getSlonikPreamble();
	var slonikScript = 'try {\n'
		+ 'uninstall node(id=' + node_id+');\n'
		+ '}\n'
		+ 'on error {\n'
		+ 'echo \'node not installed\';\n'
		+ '}\n';
	
	/**
	 * uninstall the node IF it hasn't already happened.
	 * We need to do this as a seperate script because the uninstall will
	 * cause the slon to terminate (as it should)
	 * but the sync we do below in the store path/node script requires
	 * the slon to be running again.
	 */
	var slonik=this.coordinator.createSlonik('readd node',slonikPreamble,slonikScript);
	slonik.run();
	this.coordinator.join(slonik);
	
	slonikScript =  'store node(id=' + node_id + ',event node=' + provider+');\n' 
		+ 'store path(server=' + node_id + ',client=' + provider
		+ ',conninfo=@CONNINFO' + node_id+');\n'
		+ 'store path(server=' + provider + ',client=' + node_id  
		+ ', conninfo=@CONNINFO' + provider +');\n'
		
		+ 'sync(id=' + provider +');\n'
		+ 'wait for event(origin=' + provider + ',wait on=' + provider + ',confirmed=all);\n';
	
	
	//
	// We must restart the slon for node_id and provider
	// the store path statements above do not take effect due to bug # 120
	this.slonArray[node_id-1].stop();
	this.coordinator.join(this.slonArray[node_id-1]);
	this.coordinator.log('starting slon for node ' + node_id);
	this.slonArray[node_id-1] = this.coordinator.createSlonLauncher('db' + node_id);
	this.slonArray[node_id-1].run();
	
	slonik=this.coordinator.createSlonik('readd node',slonikPreamble,slonikScript);
	slonik.run();
	this.coordinator.join(slonik);
	this.testResults.assertCheck('readd node success',slonik.getReturnCode(),0);
	
	this.slonArray[provider-1].stop();
	this.coordinator.join(this.slonArray[provider-1]);
	this.slonArray[provider-1] = this.coordinator.createSlonLauncher('db' + provider);
	this.slonArray[provider-1].run();
	
	
	this.subscribeSet(1, origin,provider,[node_id]);
	
	
}

